export const DAEMON_HTTP_URL = process.env.NEXT_PUBLIC_DAEMON_HTTP_URL ?? 'http://localhost:4317';

export async function submitBrief(brief: string): Promise<void> {
  const res = await fetch(`${DAEMON_HTTP_URL}/api/brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `daemon returned ${res.status}`);
  }
}
