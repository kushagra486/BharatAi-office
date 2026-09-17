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
// Verification status as of the real keys this project currently has:
// - Groq (openai/gpt-oss-120b, openai/gpt-oss-20b): CONFIRMED working —
//   live chat completion, JSON mode, and tool-calling all succeeded. The
//   original llama-3.3-70b-versatile / llama-3.1-8b-instant / gemma2-9b-it
//   slugs were retired from Groq's catalog and 404'd with model_not_found.
// - OpenRouter (nvidia/nemotron-3-super-120b-a12b:free,
//   nex-agi/nex-n2.5-pro:free, liquid/lfm-2.5-2.6b:free): CONFIRMED
//   working — real 200 responses. The original meta-llama/llama-3.3-70b-
//   instruct:free / qwen-2.5-72b-instruct:free / mistral-7b-instruct:free
//   / gemini-2.0-flash-exp:free slugs are all dead (OpenRouter now serves
//   those only as paid, or has no free endpoint left for them at all).
//   Note some other OpenRouter :free models (e.g. google/gemma-4-31b-it,
//   z-ai/glm-5.2) hit 429 "temporarily rate-limited upstream" on the
//   shared free pool — that's a capacity issue, not a dead slug; the three
//   used below responded cleanly.
// - NVIDIA NIM: NOT working with the key currently configured — every
//   model tried (including ones this account's own /v1/models listing
//   returns) 404'd with "Function ... Not found for account", and a
//   couple of others returned 410 Gone (model reached end-of-life). This
//   looks like an account-entitlement issue rather than a slug problem:
//   NVIDIA's self-serve keys often need you to open each model's own page
//   on build.nvidia.com and explicitly request/deploy that model before
//   it's actually invocable, even though it appears in the general
//   catalog. Left wired in below (harmless — the router's fallback chain
//   just skips a candidate that errors) so this starts working the moment
//   that's sorted out on NVIDIA's side, with no code change needed.
export const ASSIGNMENTS: Record<string, Assignment> = {
  nova: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-120b' },
    fallbacks: [
      { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
      { provider: 'nvidia', model: 'meta/llama-3.1-70b-instruct' },
    ],
  },
  kael: {
    primary: { provider: 'nvidia', model: 'meta/llama-3.3-70b-instruct' },
    fallbacks: [
      { provider: 'groq', model: 'openai/gpt-oss-120b' },
      { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
    ],
  },
  priya: {
    primary: { provider: 'nvidia', model: 'nvidia/llama-3.1-nemotron-70b-instruct' },
    fallbacks: [
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
      { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    ],
  },
  devraj: {
    primary: { provider: 'nvidia', model: 'mistralai/mixtral-8x22b-instruct-v0.1' },
    fallbacks: [
      { provider: 'openrouter', model: 'liquid/lfm-2.5-2.6b:free' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  simran: {
    primary: { provider: 'nvidia', model: 'qwen/qwen2.5-72b-instruct' },
    fallbacks: [
      { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  arjun: {
    primary: { provider: 'nvidia', model: 'google/gemma-2-27b-it' },
    fallbacks: [
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
      { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    ],
  },
  meera: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-20b' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.1-8b-instruct' },
      { provider: 'openrouter', model: 'liquid/lfm-2.5-2.6b:free' },
    ],
  },
  raghav: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-20b' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.3-70b-instruct' },
      { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    ],
  },
  tanya: {
    primary: { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'nvidia/llama-3.1-nemotron-70b-instruct' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  farhan: {
    primary: { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'google/gemma-2-27b-it' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  isha: {
    primary: { provider: 'openrouter', model: 'liquid/lfm-2.5-2.6b:free' },
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
