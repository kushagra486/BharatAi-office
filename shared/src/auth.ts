import { randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from './supabaseHive';

// A single shared-password gate, not multi-user accounts — this stays a
// local-first, single-operator tool (PRD §3 non-goals). Session tokens live
// in Postgres (the `sessions` table) rather than in-memory, because
// serverless functions are stateless per-invocation — an in-memory Map
// (the original daemon/src/auth/auth.ts design) wouldn't reliably survive
// between the login call and the next request once this runs as a Next.js
// API route instead of one long-lived daemon process.
const TOKEN_TTL_MS = 7 * 24 * 60 * 60_000;

export function isAuthEnabled(): boolean {
  return (process.env.APP_PASSWORD ?? '').length > 0;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Verifies `password` against APP_PASSWORD and, if it matches, issues a new session token. */
export async function login(password: string): Promise<string | null> {
  if (!isAuthEnabled()) return null;
  if (!constantTimeEquals(password, process.env.APP_PASSWORD ?? '')) return null;

  await db().from('sessions').delete().lt('expires_at', new Date().toISOString()); // lazy prune, same as before
  const token = randomBytes(32).toString('hex');
  const { error } = await db()
    .from('sessions')
    .insert({ token, expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString() });
  if (error) throw new Error(error.message);
  return token;
}

export async function logout(token: string): Promise<void> {
  await db().from('sessions').delete().eq('token', token);
}

export async function isValidToken(token: string | undefined | null): Promise<boolean> {
  if (!isAuthEnabled()) return true; // no password configured -> nothing to gate
  if (!token) return false;
  const { data } = await db().from('sessions').select('expires_at').eq('token', token).maybeSingle();
  if (!data) return false;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await db().from('sessions').delete().eq('token', token);
    return false;
  }
  return true;
}
