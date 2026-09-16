import cors from '@fastify/cors';
import Fastify, { type FastifyRequest } from 'fastify';
import { env } from './env';
import './hive/db'; // initializes + migrates the Hive on import
import * as hive from './hive/hive';
import { ensureRepo } from './git/gitModule';
import { applyHumanResolution, decomposeBrief, startNovaLoop } from './nova/nova';
import { getUsage } from './llm/router';
import { attachWebSocketServer } from './ws/server';
import { isAuthEnabled, isValidToken, login, logout } from './auth/auth';

// Paths reachable without a session token even when APP_PASSWORD is set —
// checking whether a login is required at all, and logging in, obviously
// can't themselves require being logged in.
const AUTH_EXEMPT_PATHS = new Set(['/api/health', '/api/auth/status', '/api/login']);

function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
}

async function main() {
  await ensureRepo();

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  // Single shared-password gate (see auth/auth.ts) — a no-op when
  // APP_PASSWORD isn't set, so this doesn't change behavior for anyone who
  // hasn't opted in.
  app.addHook('onRequest', async (request, reply) => {
    if (!isAuthEnabled() || AUTH_EXEMPT_PATHS.has(request.url.split('?')[0])) return;
    if (!isValidToken(bearerToken(request))) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/auth/status', async () => ({ authRequired: isAuthEnabled() }));

  app.post<{ Body: { password?: string } }>('/api/login', async (request, reply) => {
    const token = login(request.body?.password ?? '');
    if (!token) {
      reply.code(401);
      return { error: 'invalid password' };
    }
    return { token };
  });

  app.post('/api/logout', async (request) => {
    const token = bearerToken(request);
    if (token) logout(token);
    return { ok: true };
  });

  app.get('/api/agents', async () => hive.listAgents());

  app.get('/api/tasks', async () => hive.listTasks());

  app.get('/api/messages', async () => hive.listMessages({ limit: 200 }));

  app.get('/api/brief', async () => hive.getBrief() ?? null);

  app.post<{ Body: { brief: string } }>('/api/brief', async (request, reply) => {
    const { brief } = request.body ?? { brief: '' };
    if (!brief || !brief.trim()) {
      reply.code(400);
      return { error: 'brief is required' };
    }
    const tasks = await decomposeBrief(brief.trim());
    return { taskCount: tasks.length, tasks };
  });

  app.get('/api/escalations', async () => hive.listEscalations());

  app.post<{ Params: { id: string } }>('/api/escalations/:id/approve', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) {
      reply.code(400);
      return { error: 'invalid escalation id' };
    }
    return applyHumanResolution(id, 'approved');
  });

  app.post<{ Params: { id: string } }>('/api/escalations/:id/deny', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) {
      reply.code(400);
      return { error: 'invalid escalation id' };
    }
    return applyHumanResolution(id, 'denied');
  });

  app.get<{ Querystring: { q?: string } }>('/api/memory/search', async (request) => hive.searchMemory(request.query.q ?? ''));

  // Per-agent LLM call/token visibility across the multi-provider router —
  // the "token control" surface. Read-only for now; no dedicated frontend
  // panel yet, but inspectable directly.
  app.get('/api/llm/usage', async () => getUsage());

  await app.listen({ port: env.DAEMON_PORT, host: '0.0.0.0' });

  attachWebSocketServer(app.server);
  startNovaLoop();

  console.log(`[daemon] Hive ready at ${env.HIVE_DB_PATH}`);
  console.log(`[daemon] Project workdir: ${env.PROJECT_WORKDIR}`);
  console.log(`[daemon] listening on :${env.DAEMON_PORT} (HTTP + WS at /ws)`);
}

main().catch((err) => {
  console.error('[daemon] fatal error during startup', err);
  process.exit(1);
});
