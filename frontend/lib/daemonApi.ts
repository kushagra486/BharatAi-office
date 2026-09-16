import type { Escalation, LlmUsageByAgent, MemoryEntry } from '@bharat-ai-office/shared';
import { clearToken, getToken } from './authToken';

export const DAEMON_HTTP_URL = process.env.NEXT_PUBLIC_DAEMON_HTTP_URL ?? 'http://localhost:4317';

/** A 401 from the daemon means the session token is missing/expired — drop it and send the viewer back to /login. */
function handleUnauthorized(): void {
  clearToken();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${DAEMON_HTTP_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error ?? `daemon returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
}

export interface AuthStatus {
  authRequired: boolean;
}

/** Unauthenticated by design — this is how a client learns whether it needs to log in at all. */
export async function getAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${DAEMON_HTTP_URL}/api/auth/status`);
  if (!res.ok) throw new Error(`daemon returned ${res.status}`);
  return res.json() as Promise<AuthStatus>;
}

export async function login(password: string): Promise<string> {
  const res = await fetch(`${DAEMON_HTTP_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error ?? 'login failed');
  }
  const { token } = (await res.json()) as { token: string };
  return token;
}

export async function logout(): Promise<void> {
  await postJson('/api/logout').catch(() => undefined); // best-effort server-side revoke
  clearToken();
}

export async function submitBrief(brief: string): Promise<void> {
  await postJson('/api/brief', { brief });
}

export async function approveEscalation(id: number): Promise<Escalation> {
  return postJson<Escalation>(`/api/escalations/${id}/approve`);
}

export async function denyEscalation(id: number): Promise<Escalation> {
  return postJson<Escalation>(`/api/escalations/${id}/deny`);
}

export async function searchMemory(query: string): Promise<MemoryEntry[]> {
  return request<MemoryEntry[]>(`/api/memory/search?q=${encodeURIComponent(query)}`);
}

export async function getLlmUsage(): Promise<LlmUsageByAgent> {
  return request<LlmUsageByAgent>('/api/llm/usage');
}
