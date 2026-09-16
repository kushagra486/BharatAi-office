import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { HiveEvent } from '@bharat-ai-office/shared';
import * as hive from '../hive/hive';
import { hiveEvents } from '../hive/hive';
import { agentEvents, type AgentExitEvent, type AgentOutputEvent } from '../agents/AgentRunner';
import { isValidToken } from '../auth/auth';

// A WS upgrade request has no Authorization header support in the browser
// WebSocket API, so the token rides along as a query param instead
// (useHiveSocket.ts appends it) — same session token the HTTP API's
// Authorization: Bearer header carries.
const UNAUTHORIZED_CLOSE_CODE = 4001;

// Broadcasts every Hive write (hiveEvents bus) plus each employee's live
// tool-use output/exit (agentEvents bus, for the employee side panel's
// terminal feed) to all connected clients over one WebSocket. A fresh
// client gets a full snapshot on connect so it doesn't have to wait for the
// next write.
export function attachWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  function send(socket: WebSocket, event: HiveEvent) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  }

  function broadcast(event: HiveEvent) {
    const data = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    }
  }

  wss.on('connection', (socket, request) => {
    const token = new URL(request.url ?? '', 'http://internal').searchParams.get('token');
    if (!isValidToken(token)) {
      socket.close(UNAUTHORIZED_CLOSE_CODE, 'unauthorized');
      return;
    }

    send(socket, {
      type: 'snapshot',
      payload: {
        agents: hive.listAgents(),
        tasks: hive.listTasks(),
        messages: hive.listMessages({ limit: 200 }),
        escalations: hive.listEscalations(),
        brief: hive.getBrief() ?? null,
      },
    });
  });

  hiveEvents.on('hive-event', broadcast);

  agentEvents.on('output', (event: AgentOutputEvent) => {
    broadcast({ type: 'agent:output', payload: event });
  });

  agentEvents.on('exit', (event: AgentExitEvent) => {
    broadcast({ type: 'agent:exit', payload: event });
  });

  return wss;
}
