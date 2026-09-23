import type { ChatCompletion, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { LlmUsageByAgent, LlmUsageStats, ModelUsageStats } from '../llm-types';
import { AGENT_TIER, TIER_POOLS, assignmentFor, type Assignment, type ModelRef } from './assignments';
import { getClient, isProviderConfigured } from './providers';
import { acquireSlot, getHeadroomFraction, reconcileTokens, withRetry } from './rateLimiter';
import { db } from '../supabaseHive';

export interface ChatCompleteParams {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  responseFormatJson?: boolean;
  temperature?: number;
  maxTokens?: number;
}

// A cap, not a target — generous enough that a real file-write tool call
// (which can carry a whole file's contents as a JSON argument) never gets
// truncated mid-write, but tight enough to bound the worst case: a
// reasoning model rambling for thousands of tokens before it ever calls a
// tool. Bounding that worst case is what actually shortens wall-clock time
// per turn, not shrinking normal responses (that's rolePrompts.ts's job —
// see REASONING_SCAFFOLD's concision guidance).
const DEFAULT_MAX_TOKENS = 4096;

// Usage now lives in the `llm_usage` table (record_llm_usage does an
// atomic upsert-with-increment) instead of an in-memory Map — Nova's calls
// and the worker's employee calls are separate processes now, so they need
// one shared, durable counter, not two independent in-memory ones.
async function recordUsage(agentId: string, ref: ModelRef, completion: ChatCompletion): Promise<void> {
  const tokens = completion.usage?.total_tokens ?? 0;
  const { error } = await db().rpc('record_llm_usage', {
    p_agent_id: agentId,
    p_provider: ref.provider,
    p_model: ref.model,
    p_tokens: tokens,
  });
  if (error) throw new Error(error.message);
}

// A real tokenizer isn't worth the dependency here — the rate limiter only
// needs a conservative pre-call estimate to decide whether a request would
// blow a provider's token-per-minute budget, and reconcileTokens() (below)
// corrects it against the real completion.usage.total_tokens right after.
// ~4 chars/token is the standard rough-English heuristic; COMPLETION_ALLOWANCE
// covers the reply itself, which isn't knowable before the call returns.
const CHARS_PER_TOKEN = 4;
const COMPLETION_ALLOWANCE_TOKENS = 500;

function estimateTokens(params: ChatCompleteParams): number {
  const promptChars = params.messages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content ?? '').length), 0);
  const toolsChars = params.tools ? JSON.stringify(params.tools).length : 0;
  return Math.ceil((promptChars + toolsChars) / CHARS_PER_TOKEN) + COMPLETION_ALLOWANCE_TOKENS;
}

/** Fire-and-forget — a latency-logging hiccup must never fail or slow down the actual LLM call it's measuring. */
export async function recordLatency(provider: ModelRef['provider'], model: string, latencyMs: number): Promise<void> {
  const { error } = await db().rpc('record_model_latency', { p_provider: provider, p_model: model, p_latency_ms: latencyMs });
  if (error) throw new Error(error.message);
}

// router.ts lives in the client/server-agnostic `shared` package, so it
// can't import daemon/src/realtimeBroadcast.ts directly (that would invert
// the intended dependency direction — daemon depends on shared, never the
// reverse). This optional callback lets a daemon-side caller (AgentRunner)
// surface a warning on its own live feed without router.ts knowing
// anything about broadcast channels. Nova's calls simply omit it.
type WarnFn = (message: string) => void;

async function callModel(ref: ModelRef, params: ChatCompleteParams, onWarning?: WarnFn): Promise<ChatCompletion> {
  const estimatedTokens = estimateTokens(params);
  await acquireSlot(ref.provider, ref.model, estimatedTokens);
  const client = getClient(ref.provider);
  const startedAt = Date.now();
  try {
    const completion = await withRetry(() =>
      client.chat.completions.create({
        model: ref.model,
        messages: params.messages,
        tools: params.tools,
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(params.responseFormatJson ? { response_format: { type: 'json_object' as const } } : {}),
      })
    );
    await reconcileTokens(ref.provider, estimatedTokens, completion.usage?.total_tokens ?? estimatedTokens);
    recordLatency(ref.provider, ref.model, Date.now() - startedAt).catch((err) => {
      const message = `⚠ latency tracking failed for ${ref.provider}:${ref.model} (picker falls back to headroom-only ranking): ${(err as Error).message}`;
      console.error(`[llm-router] ${message}`);
      onWarning?.(message);
    });
    return completion;
  } catch (err) {
    // The call never happened (or never finished), so free the reservation
    // instead of leaving it stuck against this minute's budget — otherwise
    // a string of failures would starve the *next* successful call's
    // headroom for no reason.
    await reconcileTokens(ref.provider, estimatedTokens, 0);
    throw err;
  }
}

// Cold-start assumption for a (provider, model) with no recorded latency
// samples yet — keeps an untested candidate from being unfairly favored
// (0ms) or starved (Infinity) in the ranking below until real data exists.
const DEFAULT_LATENCY_MS = 2500;

// A candidate below this headroom fraction is close enough to its rate
// limit that picking it "because it's historically fast" would likely just
// mean an immediate 429 and a fallback anyway — better to rank by
// remaining headroom instead once everyone's this tight.
const MIN_HEADROOM_TO_RANK_BY_LATENCY = 0.1;

async function getLatencyMap(): Promise<Map<string, number>> {
  const { data, error } = await db().from('model_latency_stats').select('provider, model, avg_latency_ms');
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  for (const row of data ?? []) map.set(`${row.provider}:${row.model}`, row.avg_latency_ms as number);
  return map;
}

/**
 * Resolves a task's model assignment ONCE — called by AgentRunner at the
 * start of a task's loop, not per turn. Pinning per-task (not per-call)
 * keeps one task's tool-calling behavior consistent across all its turns
 * instead of potentially switching models mid-task, which would risk
 * inconsistent style/quality within a single piece of work for no real
 * benefit (the next task re-picks fresh, so the system still adapts).
 *
 * Ranks the agent's tier pool by live rate-limit headroom + observed
 * latency. Falls back to the static ASSIGNMENTS bootstrap (assignmentFor)
 * for any agent without a tier (Nova — see AGENT_TIER's comment) or on any
 * read failure, so a routing-layer hiccup degrades to today's known-good
 * fixed behavior instead of blocking a task from starting.
 */
export async function pickTaskAssignment(agentId: string): Promise<Assignment> {
  const tier = AGENT_TIER[agentId];
  if (!tier) return assignmentFor(agentId);

  try {
    const pool = TIER_POOLS[tier].filter((ref) => isProviderConfigured(ref.provider));
    if (pool.length === 0) return assignmentFor(agentId);

    const latencyMap = await getLatencyMap();
    const scored = await Promise.all(
      pool.map(async (ref) => ({
        ref,
        headroom: await getHeadroomFraction(ref.provider),
        latency: latencyMap.get(`${ref.provider}:${ref.model}`) ?? DEFAULT_LATENCY_MS,
      }))
    );

    const withHeadroom = scored.filter((s) => s.headroom > MIN_HEADROOM_TO_RANK_BY_LATENCY);
    const ranked =
      withHeadroom.length > 0
        ? withHeadroom.sort((a, b) => a.latency - b.latency)
        : scored.sort((a, b) => b.headroom - a.headroom); // everyone's tight — just try whoever has the most room

    return { primary: ranked[0].ref, fallbacks: ranked.slice(1).map((s) => s.ref) };
  } catch (err) {
    console.error(`[llm-router] pickTaskAssignment failed for "${agentId}", falling back to static assignment`, err);
    return assignmentFor(agentId);
  }
}

/**
 * The one entry point both Nova and every employee's AgentRunner call
 * through. Resolves the agent's assigned provider+model (or uses a
 * pre-resolved `assignmentOverride` — see pickTaskAssignment, which
 * AgentRunner calls once per task so every turn of that task stays on the
 * same picked model), rate-limits and retries against it, and on exhausted
 * retries walks the fallback chain (each on a different provider) rather
 * than failing outright — this is the "no clogging" mechanism: a
 * rate-limited or down provider degrades to a different one instead of
 * blocking the agent.
 */
export async function chatComplete(
  agentId: string,
  params: ChatCompleteParams,
  assignmentOverride?: Assignment,
  onWarning?: WarnFn
): Promise<ChatCompletion> {
  const assignment = assignmentOverride ?? assignmentFor(agentId);
  const candidates = [assignment.primary, ...assignment.fallbacks].filter((ref) => isProviderConfigured(ref.provider));

  if (candidates.length === 0) {
    throw new Error(
      `No configured LLM provider available for agent "${agentId}" — set at least one of NVIDIA_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY in the environment.`
    );
  }

  let lastErr: unknown;
  for (const ref of candidates) {
    try {
      const completion = await callModel(ref, params, onWarning);
      await recordUsage(agentId, ref, completion);
      return completion;
    } catch (err) {
      lastErr = err;
      console.error(`[llm-router] ${agentId} via ${ref.provider}:${ref.model} failed, trying next candidate`, err);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`all LLM candidates failed for agent "${agentId}"`);
}

/** Convenience wrapper for Nova's JSON-mode reasoning calls. */
export async function chatCompleteJson(agentId: string, systemPrompt: string, userPrompt: string): Promise<Record<string, unknown>> {
  const completion = await chatComplete(agentId, {
    responseFormatJson: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  const content = completion.choices[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function getUsage(): Promise<LlmUsageByAgent> {
  const { data, error } = await db().from('llm_usage').select('*');
  if (error) throw new Error(error.message);
  const result: LlmUsageByAgent = {};
  for (const row of data ?? []) {
    result[row.agent_id as string] = {
      provider: row.provider,
      model: row.model,
      calls: row.calls,
      approxTokens: row.approx_tokens,
      lastCallAt: row.last_call_at,
    } satisfies LlmUsageStats;
  }
  return result;
}

/** Every (agent, provider, model) combination ever called, each with its own real running total — see llm_usage_by_model's migration comment for why this exists separately from getUsage() above. */
export async function getUsageByModel(): Promise<ModelUsageStats[]> {
  const { data, error } = await db().from('llm_usage_by_model').select('*').order('approx_tokens', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): ModelUsageStats => ({
      agentId: row.agent_id,
      provider: row.provider,
      model: row.model,
      calls: row.calls,
      approxTokens: row.approx_tokens,
      lastCallAt: row.last_call_at,
    })
  );
}
