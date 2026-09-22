import type { ChatCompletion, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { LlmUsageByAgent, LlmUsageStats } from '../llm-types';
import { assignmentFor, type ModelRef } from './assignments';
import { getClient, isProviderConfigured } from './providers';
import { acquireSlot, reconcileTokens, withRetry } from './rateLimiter';
import { db } from '../supabaseHive';

export interface ChatCompleteParams {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  responseFormatJson?: boolean;
  temperature?: number;
}

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

async function callModel(ref: ModelRef, params: ChatCompleteParams): Promise<ChatCompletion> {
  const estimatedTokens = estimateTokens(params);
  await acquireSlot(ref.provider, ref.model, estimatedTokens);
  const client = getClient(ref.provider);
  try {
    const completion = await withRetry(() =>
      client.chat.completions.create({
        model: ref.model,
        messages: params.messages,
        tools: params.tools,
        temperature: params.temperature ?? 0.2,
        ...(params.responseFormatJson ? { response_format: { type: 'json_object' as const } } : {}),
      })
    );
    await reconcileTokens(ref.provider, estimatedTokens, completion.usage?.total_tokens ?? estimatedTokens);
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

/**
 * The one entry point both Nova and every employee's AgentRunner call
 * through. Resolves the agent's assigned provider+model, rate-limits and
 * retries against it, and on exhausted retries walks the fallback chain
 * (each on a different provider) rather than failing outright — this is
 * the "no clogging" mechanism: a rate-limited or down provider degrades to
 * a different one instead of blocking the agent.
 */
export async function chatComplete(agentId: string, params: ChatCompleteParams): Promise<ChatCompletion> {
  const assignment = assignmentFor(agentId);
  const candidates = [assignment.primary, ...assignment.fallbacks].filter((ref) => isProviderConfigured(ref.provider));

  if (candidates.length === 0) {
    throw new Error(
      `No configured LLM provider available for agent "${agentId}" — set at least one of NVIDIA_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY in the environment.`
    );
  }

  let lastErr: unknown;
  for (const ref of candidates) {
    try {
      const completion = await callModel(ref, params);
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
