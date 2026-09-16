import 'dotenv/config';
import path from 'node:path';

function resolveFromRepoRoot(p: string): string {
  return path.isAbsolute(p) ? p : path.join(__dirname, '..', '..', p);
}

// This workspace is no longer a Fastify/WebSocket daemon — the serverless
// migration moved the HTTP API to frontend/app/api/** and Nova's periodic
// reasoning to a Netlify Scheduled Function (frontend/netlify/functions/).
// What's left here is the one piece that genuinely can't be serverless
// (PRD §5.1): AgentRunner's real file edits + git commits, run as a small
// always-on worker process that polls Supabase for ready tasks.
export const env = {
  GROQ_API_KEY: process.env.GROQ_API_KEY ?? '',
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY ?? '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
  PROJECT_WORKDIR: resolveFromRepoRoot(process.env.PROJECT_WORKDIR ?? './workdir'),
  // Hard cap on employees with an active tool-use loop at once (PRD §11 risk:
  // "10 simultaneous sessions may hit rate limits"). Independent of the
  // per-provider rate limiter — this bounds total concurrency regardless of
  // which providers the active agents happen to be assigned to.
  MAX_CONCURRENT_SESSIONS: Number(process.env.MAX_CONCURRENT_SESSIONS ?? 4),
  DISPATCH_POLL_INTERVAL_MS: Number(process.env.DISPATCH_POLL_INTERVAL_MS ?? 4000),
};
