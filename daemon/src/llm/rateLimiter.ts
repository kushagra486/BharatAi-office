import type { ProviderId } from './providers';

// Conservative starting RPM defaults per provider's free tier. These are
// not published guarantees — tune them against what you actually observe
// (a 429 from the provider is the real signal; this limiter just tries to
// avoid triggering one under normal concurrent load from the 11 seats
// sharing each provider).
const RPM_LIMITS: Record<ProviderId, number> = {
  nvidia: 35,
  groq: 28,
  openrouter: 18,
};

const RETRY_BASE_MS = 500;
const MAX_RETRIES = 3;

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

function bucketKey(provider: ProviderId, model: string): string {
  return `${provider}:${model}`;
}

/**
 * Sliding 60s window limiter. Resolves immediately if under the provider's
 * budget, otherwise waits until the window rolls over. Hand-rolled — no new
 * dependency needed for something this small.
 */
export async function acquireSlot(provider: ProviderId, model: string): Promise<void> {
  const key = bucketKey(provider, model);
  const limit = RPM_LIMITS[provider];
  const windowMs = 60_000;

  for (;;) {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart >= windowMs) {
      bucket = { windowStart: now, count: 0 };
      buckets.set(key, bucket);
    }
    if (bucket.count < limit) {
      bucket.count += 1;
      return;
    }
    const waitMs = windowMs - (now - bucket.windowStart) + 50;
    await sleep(waitMs);
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
