import { randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../env';

// A single shared-password gate, not multi-user accounts — this stays a
// local-first, single-operator tool (PRD §3 non-goals); this just adds a
// real login screen for when the daemon is reachable on a network. If
// APP_PASSWORD isn't set, auth is disabled entirely so existing setups
// keep working unchanged (same "optional, graceful" pattern the LLM
// provider keys already use).
const TOKEN_TTL_MS = 7 * 24 * 60 * 60_000;

const tokens = new Map<string, number>(); // token -> expiresAt

export function isAuthEnabled(): boolean {
  return env.APP_PASSWORD.length > 0;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Lengths differ -> definitely not equal, but still do a same-size
  // comparison first so the mismatch itself doesn't leak timing info.
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Drops any expired tokens — called lazily on login/verify rather than on a timer. */
function pruneExpired(): void {
  const now = Date.now();
  for (const [token, expiresAt] of tokens) {
    if (expiresAt <= now) tokens.delete(token);
  }
}

/** Verifies `password` against APP_PASSWORD and, if it matches, issues a new session token. */
export function login(password: string): string | null {
  if (!isAuthEnabled()) return null;
  if (!constantTimeEquals(password, env.APP_PASSWORD)) return null;

  pruneExpired();
  const token = randomBytes(32).toString('hex');
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

export function logout(token: string): void {
  tokens.delete(token);
}

export function isValidToken(token: string | undefined | null): boolean {
  if (!isAuthEnabled()) return true; // no password configured -> nothing to gate
  if (!token) return false;
  const expiresAt = tokens.get(token);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    tokens.delete(token);
    return false;
  }
  return true;
}
