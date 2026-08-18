import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { HiveEvent } from '@bharat-ai-office/shared';
import * as hive from '../hive/hive';
import { hiveEvents } from '../hive/hive';
import { ptyEvents, type PtyExitEvent, type PtyOutputEvent } from '../pty/PtyManager';

// Broadcasts every Hive write (Phase 1's hiveEvents bus) plus PTY output/exit
// (Phase 2's ptyEvents bus, for the employee side panel's live terminal
// feed) to all connected clients over one WebSocket. A fresh client gets a
// full snapshot on connect so it doesn't have to wait for the next write.
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

  wss.on('connection', (socket) => {
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

  ptyEvents.on('output', (event: PtyOutputEvent) => {
    broadcast({ type: 'pty:output', payload: event });
  });

  ptyEvents.on('exit', (event: PtyExitEvent) => {
    broadcast({ type: 'pty:exit', payload: event });
  });

  return wss;
}
