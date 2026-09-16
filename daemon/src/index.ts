import { ensureRepo } from './git/gitModule';
import { startDispatchLoop } from './dispatch';
import { env } from './env';

// This worker is the one piece of the old daemon that stays a persistent
// process (PRD §5.1): AgentRunner's real file edits + git commits can't run
// as a stateless function. Everything else — the HTTP API, auth, Nova's
// reasoning — moved to frontend/app/api/** and a Netlify Scheduled Function.
// This process has no HTTP server of its own; it only polls Supabase for
// ready tasks and runs them.
async function main() {
  await ensureRepo();
  startDispatchLoop();

  console.log(`[worker] project workdir: ${env.PROJECT_WORKDIR}`);
  console.log(`[worker] dispatch poll interval: ${env.DISPATCH_POLL_INTERVAL_MS}ms`);
  console.log(`[worker] max concurrent sessions: ${env.MAX_CONCURRENT_SESSIONS}`);
}

main().catch((err) => {
  console.error('[worker] fatal error during startup', err);
  process.exit(1);
});
