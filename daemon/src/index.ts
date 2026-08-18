import cors from '@fastify/cors';
import Fastify from 'fastify';
import { env } from './env';
import './hive/db'; // initializes + migrates the Hive on import
import * as hive from './hive/hive';
import { ensureRepo } from './git/gitModule';
import { decomposeBrief, startNovaLoop } from './nova/nova';
import { attachWebSocketServer } from './ws/server';

async function main() {
  await ensureRepo();

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get('/api/health', async () => ({ ok: true }));

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
