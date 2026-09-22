import type { ProviderId } from './providers';
import { db } from '../supabaseHive';

// Per-provider RPM/RPD budgets — keyed by provider (the API key), not by
// model. See the migration `rate_limit_and_usage_functions` for the actual
// atomic check-and-increment (a Postgres function with `for update` row
// locking) — this used to be an in-memory Map mutation, safe only because
// it ran inside one single-threaded Node process; now that Nova's calls (a
// Netlify Scheduled Function) and the worker's employee calls run as
// separate processes hitting the same provider key, the increment has to
// be a real atomic database operation instead.
const RPM_LIMITS: Record<ProviderId, number> = {
  nvidia: 30,
  groq: 24,
  openrouter: 15,
};

const RPD_LIMITS: Partial<Record<ProviderId, number>> = {
  openrouter: 45,
};

// Tokens-per-minute budgets, tracked separately from RPM/RPD above — a
// provider can 429 on token volume well before it 429s on request count.
// Confirmed via Groq's own docs: the free tier for openai/gpt-oss-120b and
// openai/gpt-oss-20b is 8,000 TPM per model, far tighter than its 30 RPM —
// a handful of verbose exchanges can trip this with room to spare on RPM.
// NVIDIA NIM and OpenRouter don't publish a fixed per-model TPM figure the
// way Groq does (NIM's free tier is account-entitlement based, not a
// documented token budget), so they're deliberately left unset here rather
// than guessed — `acquireTokens` below is a no-op for any provider missing
// from this map.
const TPM_LIMITS: Partial<Record<ProviderId, number>> = {
  groq: 7_000, // a little under Groq's real 8,000 to leave headroom
};

const DAY_MS = 24 * 60 * 60_000;
const RETRY_BASE_MS = 500;
const MAX_RETRIES = 3;

// Serverless functions have execution time limits, so this can't block
// forever waiting for a slot the way the old in-process loop could — cap
// the total wait and throw, letting router.ts's existing fallback-chain
// logic move on to the next provider instead.
const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 20; // ~10s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks + increments all three windows (minute request count, day request
 * count, minute token budget) atomically in one transaction. This has to
 * be a single call, not three separate ones — a call that passed one
 * check but failed another would still commit the one that passed,
 * wasting real budget on every retry attempt. See the
 * `consolidate_rate_limit_with_tpm` migration for the actual function.
 */
async function tryAcquireFull(
  provider: ProviderId,
  minuteLimit: number,
  dayLimit: number | undefined,
  estimatedTokens: number,
  tokenLimit: number | undefined
): Promise<boolean> {
  const { data, error } = await db().rpc('acquire_rate_limit_full', {
    p_provider: provider,
    p_minute_ms: 60_000,
    p_minute_limit: minuteLimit,
    p_day_ms: dayLimit === undefined ? null : DAY_MS,
    p_day_limit: dayLimit ?? 0,
    p_estimated_tokens: estimatedTokens,
    p_token_limit: tokenLimit ?? null,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/**
 * Enforces the per-minute, per-day, and (where set) per-minute-token
 * provider budgets before letting a call through. `model` is accepted for
 * call-site symmetry/future logging but doesn't key the bucket — see the
 * RPM_LIMITS comment above for why. `estimatedTokens` is a rough pre-call
 * guess (router.ts derives it from the outgoing prompt); pair every
 * successful `acquireSlot` call with a `reconcileTokens` call once the
 * real usage is known, or the token budget drifts from reality.
 */
export async function acquireSlot(provider: ProviderId, _model: string, estimatedTokens: number): Promise<void> {
  const minuteLimit = RPM_LIMITS[provider];
  const dayLimit = RPD_LIMITS[provider];
  const tokenLimit = TPM_LIMITS[provider];

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (await tryAcquireFull(provider, minuteLimit, dayLimit, estimatedTokens, tokenLimit)) return;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`rate limit slot for provider "${provider}" did not free up in time`);
}

/** Corrects a provider's token-budget reservation with the real usage once a call completes. No-op for providers without a configured TPM budget. */
export async function reconcileTokens(provider: ProviderId, estimatedTokens: number, actualTokens: number): Promise<void> {
  const tokenLimit = TPM_LIMITS[provider];
  if (tokenLimit === undefined) return;
  const { error } = await db().rpc('reconcile_rate_limit_tokens', {
    p_provider: provider,
    p_minute_ms: 60_000,
    p_estimated_tokens: estimatedTokens,
    p_actual_tokens: actualTokens,
  });
  if (error) throw new Error(error.message);
}

/**
 * A pure read of current usage against the same three budgets acquireSlot
 * enforces below — used only to RANK candidate models before picking one
 * (see router.ts's pickTaskAssignment), never to gate or commit anything
 * itself. Safe to be slightly stale: whichever candidate wins still goes
 * through the real atomic acquireSlot, so a stale read here can at worst
 * make the picker's ranking slightly wrong, not double-spend budget — that
 * failure mode is categorically different from (and doesn't reintroduce)
 * the partial-commit bug the TPM work fixed.
 */
export async function getHeadroomFraction(provider: ProviderId): Promise<number> {
  const minuteLimit = RPM_LIMITS[provider];
  const dayLimit = RPD_LIMITS[provider];
  const tokenLimit = TPM_LIMITS[provider];

  const { data, error } = await db().from('rate_limit_windows').select('window_type, window_start, count').eq('provider', provider);
  if (error) throw new Error(error.message);

  const now = Date.now();
  function fractionFor(windowType: string, windowMs: number, limit: number | undefined): number {
    if (limit === undefined) return 1; // no configured budget = not a constraint
    const row = data?.find((r) => r.window_type === windowType);
    if (!row) return 1; // never used yet
    const age = now - new Date(row.window_start as string).getTime();
    if (age >= windowMs) return 1; // window has already rolled over
    return Math.max(0, 1 - (row.count as number) / limit);
  }

  return Math.min(fractionFor('minute', 60_000, minuteLimit), fractionFor('day', DAY_MS, dayLimit), fractionFor('minute_tokens', 60_000, tokenLimit));
}

function isRetryableStatus(status: unknown): boolean {
  return status === 429 || (typeof status === 'number' && status >= 500);
}

/** Retries `fn` with exponential backoff on 429/5xx-shaped errors. */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: unknown } | undefined)?.status;
      if (!isRetryableStatus(status) || attempt === MAX_RETRIES) throw err;
      await sleep(RETRY_BASE_MS * 2 ** attempt);
    }
  }
  throw lastErr;
}
