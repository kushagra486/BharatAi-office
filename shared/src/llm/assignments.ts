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
//   live chat completion, JSON mode, and tool-calling all succeeded.
// - OpenRouter (nvidia/nemotron-3-super-120b-a12b:free,
//   nex-agi/nex-n2.5-pro:free, liquid/lfm-2.5-2.6b:free): CONFIRMED
//   working — real 200 responses, JSON mode and tool-calling both good.
// - NVIDIA NIM (meta/llama-3.2-11b-vision-instruct): CONFIRMED working —
//   this is the one model out of a dozen+ tried that this account can
//   actually invoke (JSON mode + tool-calling both good). Every other NIM
//   slug either 404'd with "Function ... Not found for account" (an
//   account-entitlement gap — build.nvidia.com's per-model "Get API Key"
//   grants access one model at a time, separate from just holding a valid
//   key) or 410'd as retired. If more NIM models get access-granted later,
//   re-verify with a real curl call before swapping them in here — several
//   models this account's own /v1/models listing returns still aren't
//   actually invocable.
export const ASSIGNMENTS: Record<string, Assignment> = {
  nova: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-120b' },
    fallbacks: [
      { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
      { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
    ],
  },
  kael: {
    primary: { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
    fallbacks: [
      { provider: 'groq', model: 'openai/gpt-oss-120b' },
      { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
    ],
  },
  priya: {
    primary: { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
    fallbacks: [
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
      { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    ],
  },
  devraj: {
    primary: { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
    fallbacks: [
      { provider: 'openrouter', model: 'liquid/lfm-2.5-2.6b:free' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  simran: {
    primary: { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
    fallbacks: [
      { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  arjun: {
    primary: { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
    fallbacks: [
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
      { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    ],
  },
  meera: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-20b' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
      { provider: 'openrouter', model: 'liquid/lfm-2.5-2.6b:free' },
    ],
  },
  raghav: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-20b' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
      { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    ],
  },
  tanya: {
    primary: { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  farhan: {
    primary: { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  isha: {
    primary: { provider: 'openrouter', model: 'liquid/lfm-2.5-2.6b:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
};

export function assignmentFor(agentId: string): Assignment {
  const assignment = ASSIGNMENTS[agentId];
  if (!assignment) throw new Error(`no LLM assignment configured for agent "${agentId}"`);
  return assignment;
}
