import type { ProviderId } from './providers';

// Per-provider RPM budgets — keyed by provider (the API key), not by model.
// Verified against each provider's published/reported limits (Sep 2026):
// Groq's free tier is "rate-limited... at the organization level" (one
// shared 30 RPM budget per key, not per model); NVIDIA NIM defaults to
// 40 RPM per tracked key; OpenRouter hard-caps ":free" models at 20 RPM.
// These are account-level ceilings shared across every model called with
// that key — and several of our agents share a provider under *different*
// model names (see assignments.ts), so bucketing per model instead of per
// provider let concurrent agents blow well past the real ceiling. Numbers
// below stay conservatively under each published default; they still drift
// and aren't guaranteed, so treat them as starting points to tune against
// real 429s, not promises.
const RPM_LIMITS: Record<ProviderId, number> = {
  nvidia: 30,
  groq: 24,
  openrouter: 15,
};

// OpenRouter's free-model daily ceiling (50 requests/day until $10 of
// credit has ever been purchased) is low enough that per-minute limiting
// alone won't catch it — a single busy session can exhaust it in a few
// minutes. Groq's daily cap (14,400/day) and NVIDIA's (not published) are
// generous enough not to need day-tracking yet.
const RPD_LIMITS: Partial<Record<ProviderId, number>> = {
  openrouter: 45,
};

const DAY_MS = 24 * 60 * 60_000;
const RETRY_BASE_MS = 500;
const MAX_RETRIES = 3;

interface Window {
  start: number;
  count: number;
}

const minuteBuckets = new Map<ProviderId, Window>();
const dayBuckets = new Map<ProviderId, Window>();

/** Returns the current count in `provider`'s window, resetting it first if it has rolled over. */
function currentCount(buckets: Map<ProviderId, Window>, provider: ProviderId, windowMs: number, now: number): number {
  const bucket = buckets.get(provider);
  if (!bucket || now - bucket.start >= windowMs) {
    buckets.set(provider, { start: now, count: 0 });
    return 0;
  }
  return bucket.count;
}

function commit(buckets: Map<ProviderId, Window>, provider: ProviderId): void {
  buckets.get(provider)!.count += 1;
}

function waitMsFor(buckets: Map<ProviderId, Window>, provider: ProviderId, windowMs: number, now: number): number {
  const bucket = buckets.get(provider)!;
  return windowMs - (now - bucket.start) + 50;
}

/**
 * Enforces both the per-minute and (where set) per-day provider budgets
 * before letting a call through, queuing until a slot opens rather than
 * rejecting. `model` is accepted for call-site symmetry/future logging but
 * doesn't key the bucket — see the RPM_LIMITS comment above for why.
 */
export async function acquireSlot(provider: ProviderId, _model: string): Promise<void> {
  const minuteLimit = RPM_LIMITS[provider];
  const dayLimit = RPD_LIMITS[provider];

  for (;;) {
    const now = Date.now();
    if (currentCount(minuteBuckets, provider, 60_000, now) >= minuteLimit) {
      await sleep(waitMsFor(minuteBuckets, provider, 60_000, now));
      continue;
    }
    if (dayLimit !== undefined && currentCount(dayBuckets, provider, DAY_MS, now) >= dayLimit) {
      await sleep(waitMsFor(dayBuckets, provider, DAY_MS, now));
      continue;
    }
    commit(minuteBuckets, provider);
    if (dayLimit !== undefined) commit(dayBuckets, provider);
    return;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
