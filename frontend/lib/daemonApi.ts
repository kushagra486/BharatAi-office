import type { Escalation, LlmUsageByAgent, MemoryEntry } from '@bharat-ai-office/shared';

export const DAEMON_HTTP_URL = process.env.NEXT_PUBLIC_DAEMON_HTTP_URL ?? 'http://localhost:4317';

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${DAEMON_HTTP_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error ?? `daemon returned ${res.status}`);
  }
  return res.json() as Promise<T>;
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
  const res = await fetch(`${DAEMON_HTTP_URL}/api/memory/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`daemon returned ${res.status}`);
  return res.json() as Promise<MemoryEntry[]>;
}

export async function getLlmUsage(): Promise<LlmUsageByAgent> {
  const res = await fetch(`${DAEMON_HTTP_URL}/api/llm/usage`);
  if (!res.ok) throw new Error(`daemon returned ${res.status}`);
  return res.json() as Promise<LlmUsageByAgent>;
}
