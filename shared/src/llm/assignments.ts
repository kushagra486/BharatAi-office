import type { ProviderId } from './providers';

export interface ModelRef {
  provider: ProviderId;
  model: string;
}

export interface Assignment {
  primary: ModelRef;
  /** Tried in order if the primary is rate-limited/erroring, each on a different provider. */
  fallbacks: ModelRef[];
}

// Per-agent provider+model assignment. The whole point is spreading the 11
// seats across as many distinct provider+model rate-limit buckets as
// possible, so 10 employees working concurrently don't contend for one
// pool. NOTE: exact model slugs on NVIDIA NIM / Groq / OpenRouter drift as
// providers add/retire models — verify current availability in each
// provider's model catalog before relying on this in production; this file
// is the one place to update if a slug goes stale.
//
// The Groq slugs below (openai/gpt-oss-120b, openai/gpt-oss-20b) were
// re-verified live against Groq's /v1/models + a real chat-completion call
// (JSON mode and tool-calling both confirmed working) after the original
// llama-3.3-70b-versatile / llama-3.1-8b-instant / gemma2-9b-it slugs were
// found to have been retired from Groq's catalog — every one of them 404'd
// with "model_not_found". The NVIDIA/OpenRouter slugs have NOT been
// re-verified (no key to test against yet) — check those the same way
// before relying on them.
export const ASSIGNMENTS: Record<string, Assignment> = {
  nova: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-120b' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.1-70b-instruct' },
      { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    ],
  },
  kael: {
    primary: { provider: 'nvidia', model: 'meta/llama-3.3-70b-instruct' },
    fallbacks: [
      { provider: 'groq', model: 'openai/gpt-oss-120b' },
      { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    ],
  },
  priya: {
    primary: { provider: 'nvidia', model: 'nvidia/llama-3.1-nemotron-70b-instruct' },
    fallbacks: [
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
      { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' },
    ],
  },
  devraj: {
    primary: { provider: 'nvidia', model: 'mistralai/mixtral-8x22b-instruct-v0.1' },
    fallbacks: [
      { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct:free' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  simran: {
    primary: { provider: 'nvidia', model: 'qwen/qwen2.5-72b-instruct' },
    fallbacks: [
      { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  arjun: {
    primary: { provider: 'nvidia', model: 'google/gemma-2-27b-it' },
    fallbacks: [
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
      { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
    ],
  },
  meera: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-20b' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.1-8b-instruct' },
      { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct:free' },
    ],
  },
  raghav: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-20b' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.3-70b-instruct' },
      { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    ],
  },
  tanya: {
    primary: { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'nvidia/llama-3.1-nemotron-70b-instruct' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  farhan: {
    primary: { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'google/gemma-2-27b-it' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  isha: {
    primary: { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'mistralai/mixtral-8x22b-instruct-v0.1' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
};

export function assignmentFor(agentId: string): Assignment {
  const assignment = ASSIGNMENTS[agentId];
  if (!assignment) throw new Error(`no LLM assignment configured for agent "${agentId}"`);
  return assignment;
}
