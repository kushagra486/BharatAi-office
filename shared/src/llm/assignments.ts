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
// - NVIDIA NIM: build.nvidia.com's per-model "Get API Key" grants ACCOUNT
//   access one model at a time (confirmed: a key generated on one model's
//   page also works for every other model already granted — it's not a
//   per-key scope, any valid key for the account works for anything the
//   account has been granted). Three models confirmed actually invocable
//   for this account so far (real 200s, JSON mode + tool-calling both
//   good): meta/llama-3.2-11b-vision-instruct, z-ai/glm-5.3, z-ai/glm-5.3-
//   flash — spread across the roster below instead of reusing just one.
//   moonshotai/kimi-k3 consistently times out (30-40s, no response) and
//   nvidia/nemotron-3.5-lightning-30b-a3b returns HTTP 200 but garbled
//   nonsense content — both deliberately left out, not just unverified.
//   mistralai/mistral-nemotron is also granted and gives clean JSON-mode
//   output, but silently fails tool-calling: asked to call a
//   list_directory tool, it returned prose describing invented files
//   instead of a real tool_calls entry (empty tool_calls array). Every
//   employee seat depends on real tool calls for file/shell work, so this
//   is left out too — an agent on this model would report fabricated work
//   as done. Every other NIM slug either 404'd ("Function ... Not found
//   for account" — not yet granted) or 410'd as retired. Re-verify with a
//   real curl call (both JSON mode AND tool-calling) before adding any new
//   NIM model here.
export const ASSIGNMENTS: Record<string, Assignment> = {
  nova: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-120b' },
    fallbacks: [
      { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
      { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
    ],
  },
  kael: {
    primary: { provider: 'nvidia', model: 'z-ai/glm-5.3' },
    fallbacks: [
      { provider: 'groq', model: 'openai/gpt-oss-120b' },
      { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
    ],
  },
  priya: {
    primary: { provider: 'nvidia', model: 'z-ai/glm-5.3-flash' },
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
    primary: { provider: 'nvidia', model: 'z-ai/glm-5.3' },
    fallbacks: [
      { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  arjun: {
    primary: { provider: 'nvidia', model: 'z-ai/glm-5.3-flash' },
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
      { provider: 'nvidia', model: 'z-ai/glm-5.3' },
      { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    ],
  },
  tanya: {
    primary: { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'z-ai/glm-5.3-flash' },
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
      { provider: 'nvidia', model: 'z-ai/glm-5.3' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
};

export function assignmentFor(agentId: string): Assignment {
  const assignment = ASSIGNMENTS[agentId];
  if (!assignment) throw new Error(`no LLM assignment configured for agent "${agentId}"`);
  return assignment;
}
