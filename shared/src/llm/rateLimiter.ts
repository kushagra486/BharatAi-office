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

/** Checks + increments both windows atomically in one transaction — see the `acquire_rate_limit_combo` migration for why this can't be two separate calls. */
async function tryAcquireCombo(provider: ProviderId, minuteLimit: number, dayLimit: number | undefined): Promise<boolean> {
  const { data, error } = await db().rpc('acquire_rate_limit_combo', {
    p_provider: provider,
    p_minute_ms: 60_000,
    p_minute_limit: minuteLimit,
    p_day_ms: dayLimit === undefined ? null : DAY_MS,
    p_day_limit: dayLimit ?? 0,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/**
 * Enforces both the per-minute and (where set) per-day provider budgets
 * before letting a call through. `model` is accepted for call-site
 * symmetry/future logging but doesn't key the bucket — see the RPM_LIMITS
 * comment above for why.
 */
export async function acquireSlot(provider: ProviderId, _model: string): Promise<void> {
  const minuteLimit = RPM_LIMITS[provider];
  const dayLimit = RPD_LIMITS[provider];

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (await tryAcquireCombo(provider, minuteLimit, dayLimit)) return;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`rate limit slot for provider "${provider}" did not free up in time`);
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
