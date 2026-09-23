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
// 11 agents, 8 verified models — perfect 1:1 uniqueness is impossible without
// a new provider/API key (see the roadmap). What actually matters is: (a)
// spread primaries as evenly as possible across the 3 providers instead of
// piling onto one (the old version put 5 of 11 primaries on NVIDIA alone),
// and (b) wherever two agents are still forced to share a primary, give them
// completely non-overlapping fallback chains — a shared primary *and* a
// shared fallback means both agents lose all headroom together the moment
// that provider rate-limits, instead of one of them degrading gracefully
// while the other keeps working. (The previous version of this file had
// priya and arjun on an *identical* primary+fallback chain end-to-end —
// zero diversification, not just a coincidental collision.)
//
// Current distribution: groq 3 primaries (2 models, 1 collision), nvidia 4
// primaries (3 models, 1 collision), openrouter 4 primaries (3 models, 1
// collision) — one unavoidable collision per provider, each pair given
// disjoint fallback chains below.
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
  // Was nvidia:z-ai/glm-5.3 (identical primary to kael's, plus overlapping
  // fallbacks) — moved to openrouter:nemotron as its own primary to relieve
  // NVIDIA's overload; only collides with farhan now, on a disjoint chain.
  simran: {
    primary: { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'z-ai/glm-5.3-flash' },
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
    ],
  },
  arjun: {
    primary: { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'z-ai/glm-5.3' },
      { provider: 'groq', model: 'openai/gpt-oss-120b' },
    ],
  },
  meera: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-20b' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
      { provider: 'openrouter', model: 'liquid/lfm-2.5-2.6b:free' },
    ],
  },
  // Collides with kael on nvidia:glm-5.3 (unavoidable — only 3 NVIDIA models
  // for the agents that need one) but the fallback chain is fully disjoint
  // from kael's [groq:120b, openrouter:nemotron].
  raghav: {
    primary: { provider: 'nvidia', model: 'z-ai/glm-5.3' },
    fallbacks: [
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
      { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    ],
  },
  // Collides with nova on groq:120b (unavoidable — only 2 Groq models) but
  // the fallback chain is fully disjoint from nova's [openrouter:nemotron,
  // nvidia:llama].
  tanya: {
    primary: { provider: 'groq', model: 'openai/gpt-oss-120b' },
    fallbacks: [
      { provider: 'nvidia', model: 'z-ai/glm-5.3-flash' },
      { provider: 'openrouter', model: 'liquid/lfm-2.5-2.6b:free' },
    ],
  },
  // Collides with simran on openrouter:nemotron but the fallback chain is
  // fully disjoint from simran's [nvidia:glm-5.3-flash, groq:20b].
  farhan: {
    primary: { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
    fallbacks: [
      { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
      { provider: 'groq', model: 'openai/gpt-oss-120b' },
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

// --- dynamic pool-based routing (router.ts's pickTaskAssignment) -----------
//
// ASSIGNMENTS above stays exactly as it was — it's now the static bootstrap
// this falls back to if the live picker can't resolve a pool (e.g. Nova,
// which isn't tiered, or any error in the live headroom/latency read).
//
// Only verified-working AND genuinely free models go in a pool (same
// tool-calling bar as ASSIGNMENTS' own comment describes). SambaNova was
// tested and rejected on cost, not capability — every model on its account
// carries real per-token pricing and the account has zero balance with no
// payment method attached, so calls fail with 402 PAYMENT_METHOD_REQUIRED
// before ever reaching a tool-calling test. Mistral's codestral-latest was
// rejected the same way earlier. Neither belongs here unless that's a
// real cost tradeoff someone explicitly signs up for later.
//
// Nova is deliberately NOT tiered: its calls are single-shot JSON reasoning
// (chatCompleteJson), not a 25-turn tool-use loop, so per-task pinning's
// main benefit (consistency across many turns) doesn't apply, and it's the
// highest-stakes seat — keeping it on its known-good static assignment is
// the safer choice.
export type Tier = 'code' | 'light';

export const AGENT_TIER: Partial<Record<string, Tier>> = {
  kael: 'code',
  priya: 'code',
  devraj: 'code',
  arjun: 'code',
  raghav: 'code',
  farhan: 'code',
  simran: 'code',
  meera: 'light',
  tanya: 'light',
  isha: 'light',
};

// "code": heavier reasoning/implementation work (architecture, backend,
// frontend, QA, security, DevOps, design specs).
// "light": coordination/analytics/writing — lower-stakes, higher-volume.
// Each pool spans as many distinct providers as verified so a single
// provider's rate limit never stalls a whole tier at once.
//
// gemini:gemini-flash-latest and huggingface:deepseek-ai/DeepSeek-V3.1 were
// added after a live verification pass (real tool_calls via
// tool_choice:'required', not just a plain completion) — same bar as every
// other entry here. openrouter:poolside/laguna-s-2.1:free passed the same
// check; nvidia/nemotron-3-ultra-550b-a55b:free (also tested that pass)
// failed it — wrote prose describing a fake tool call instead of a real
// one — and openrouter:qwen/qwen3-coder:free no longer exists under this
// account's key, so neither is here despite looking good on paper.
// Ordered fastest-first within each tier — this is the tie-break order
// pickTaskAssignment falls back to while every candidate still shares the
// same cold-start latency default (model_latency_stats has no real samples
// yet), so it's the ordering actually in effect today, not just cosmetic.
// Groq's LPU hardware is well-established as the fastest inference of any
// provider here; models with "flash"/lighter naming are their provider's
// own speed-optimized variant; the two big general models and the
// HF-router-hosted one (shared third-party infra, least predictable
// latency) sort last. Once real latency samples accumulate, observed data
// overrides this ordering automatically.
export const TIER_POOLS: Record<Tier, ModelRef[]> = {
  code: [
    { provider: 'groq', model: 'openai/gpt-oss-120b' },
    { provider: 'gemini', model: 'gemini-flash-latest' },
    { provider: 'nvidia', model: 'z-ai/glm-5.3-flash' },
    { provider: 'nvidia', model: 'z-ai/glm-5.3' },
    { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
    { provider: 'huggingface', model: 'deepseek-ai/DeepSeek-V3.1' },
  ],
  light: [
    { provider: 'groq', model: 'openai/gpt-oss-20b' },
    { provider: 'nvidia', model: 'meta/llama-3.2-11b-vision-instruct' },
    { provider: 'openrouter', model: 'liquid/lfm-2.5-2.6b:free' },
    { provider: 'openrouter', model: 'nex-agi/nex-n2.5-pro:free' },
    { provider: 'openrouter', model: 'poolside/laguna-s-2.1:free' },
  ],
};
