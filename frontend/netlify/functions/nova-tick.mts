import type { Config } from '@netlify/functions';
import { nova } from '@bharat-ai-office/shared';

// Replaces the old daemon/src/nova/nova.ts's startNovaLoop (a 4s setInterval
// inside one long-lived process). A serverless scheduled function can't
// poll that tightly or hold state between ticks, so this runs periodically
// instead — escalation triage and the QA pass are both idempotent against
// Postgres now (see shared/src/nova/nova.ts's comments on why the old
// in-memory dedupe guards were dropped), so a fresh invocation each time is
// safe. Five minutes trades a little latency on escalations/QA for staying
// comfortably within Netlify's scheduled-function execution model — task
// dispatch itself (starting ready tasks) isn't here at all anymore; the
// persistent worker (worker/src/dispatch.ts) polls Postgres for that
// directly, since it can't run as a stateless function either (real
// file/git work, see the PRD's §5.1 non-serverless rationale).
export default async () => {
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
};

export const config: Config = {
  schedule: '*/5 * * * *',
};
