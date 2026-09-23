import type { Agent, BriefRecord, Escalation, HiveMessage, LlmUsageByAgent, MemoryEntry, ModelUsageStats, ProjectFile, Task } from '@bharat-ai-office/shared';
import { clearToken, getToken } from './authToken';

// Same-origin now — the API used to be a separate daemon process (a
// different host/port), but it's now the Next.js app's own API routes
// (frontend/app/api/**), deployed together as one Netlify site. No base
// URL needed; relative paths resolve against wherever this app is served.

/** A 401 means the session token is missing/expired — drop it and send the viewer back to /login. */
function handleUnauthorized(): void {
  clearToken();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
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
    throw new Error(errBody.error ?? `request failed: ${res.status}`);
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
  const res = await fetch('/api/auth/status');
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return res.json() as Promise<AuthStatus>;
}

export async function login(password: string): Promise<string> {
  const res = await fetch('/api/login', {
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

export async function abandonProject(): Promise<void> {
  await request('/api/brief', { method: 'DELETE' });
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

/** Every (agent, provider, model) combination's own running token total — unlike getLlmUsage() above, this doesn't get relabeled when an agent switches models. */
export async function getLlmUsageByModel(): Promise<ModelUsageStats[]> {
  return request<ModelUsageStats[]>('/api/llm/usage-by-model');
}

// One-shot fetches for the initial state, used by useHiveSocket before its
// Supabase Realtime subscriptions take over for live updates.
export async function listAgents(): Promise<Agent[]> {
  return request<Agent[]>('/api/agents');
}

export async function listTasks(): Promise<Task[]> {
  return request<Task[]>('/api/tasks');
}

export async function listMessages(): Promise<HiveMessage[]> {
  return request<HiveMessage[]>('/api/messages');
}

export async function listEscalations(): Promise<Escalation[]> {
  return request<Escalation[]>('/api/escalations');
}

export async function getBrief(): Promise<BriefRecord | null> {
  return request<BriefRecord | null>('/api/brief');
}

export async function listProjectFiles(): Promise<ProjectFile[]> {
  return request<ProjectFile[]>('/api/files');
}

/** A signed URL good for 5 minutes — fetch fresh right before navigating to it, don't cache. */
export async function getProjectFileDownloadUrl(path: string): Promise<string> {
  const { url } = await request<{ url: string }>(`/api/files/download?path=${encodeURIComponent(path)}`);
  return url;
}

/** The diff text a task's commit produced, or null if it never committed one (still running, failed early, or predates this feature). */
export async function getTaskDiff(taskId: string): Promise<string | null> {
  const { url } = await request<{ url: string | null }>(`/api/tasks/${encodeURIComponent(taskId)}/diff`);
  if (!url) return null;
  // The signed URL's signature is its own auth — a plain unauthenticated
  // fetch to it is correct, same as the Files tab's download flow.
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}
