import type { ChatCompletion, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { assignmentFor, type ModelRef } from './assignments';
import { getClient, isProviderConfigured } from './providers';
import { acquireSlot, withRetry } from './rateLimiter';

export interface ChatCompleteParams {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  responseFormatJson?: boolean;
  temperature?: number;
}

interface UsageStats {
  provider: string;
  model: string;
  calls: number;
  approxTokens: number;
  lastCallAt: string | null;
}

const usageByAgent = new Map<string, UsageStats>();

function recordUsage(agentId: string, ref: ModelRef, completion: ChatCompletion) {
  const existing = usageByAgent.get(agentId);
  const tokens = completion.usage?.total_tokens ?? 0;
  usageByAgent.set(agentId, {
    provider: ref.provider,
    model: ref.model,
    calls: (existing?.calls ?? 0) + 1,
    approxTokens: (existing?.approxTokens ?? 0) + tokens,
    lastCallAt: new Date().toISOString(),
  });
}

async function callModel(ref: ModelRef, params: ChatCompleteParams): Promise<ChatCompletion> {
  await acquireSlot(ref.provider, ref.model);
  const client = getClient(ref.provider);
  return withRetry(() =>
    client.chat.completions.create({
      model: ref.model,
      messages: params.messages,
      tools: params.tools,
      temperature: params.temperature ?? 0.2,
      ...(params.responseFormatJson ? { response_format: { type: 'json_object' as const } } : {}),
    })
  );
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
      `No configured LLM provider available for agent "${agentId}" — set at least one of NVIDIA_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY in .env.`
    );
  }

  let lastErr: unknown;
  for (const ref of candidates) {
    try {
      const completion = await callModel(ref, params);
      recordUsage(agentId, ref, completion);
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

export function getUsage(): Record<string, UsageStats> {
  return Object.fromEntries(usageByAgent);
}
