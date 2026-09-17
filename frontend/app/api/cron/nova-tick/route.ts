import { nova } from '@bharat-ai-office/shared/server';
import { jsonNoStore } from '@/lib/noStoreJson';

// Replaces frontend/netlify/functions/nova-tick.mts now that hosting moved
// to Vercel. Vercel's Hobby plan only allows daily cron invocations, so
// instead of vercel.json crons this is triggered by a GitHub Actions
// schedule every 5 minutes (.github/workflows/nova-tick.yml) hitting this
// URL with the CRON_SECRET bearer token. Escalation triage and the QA pass
// are both idempotent against Postgres (see nova.ts's comments), so a fresh
// invocation every 5 minutes is safe.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return jsonNoStore({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    await nova.runEscalationTriage();
  } catch (err) {
    console.error('[nova-tick] escalation triage failed', err);
  }
  try {
    await nova.runQaPassIfComplete();
  } catch (err) {
    console.error('[nova-tick] QA pass failed', err);
  }

  return jsonNoStore({ ok: true });
}
