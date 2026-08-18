'use client';

import { useEffect, useRef, useState } from 'react';
import type { Agent, BriefRecord, Escalation, HiveEvent, HiveMessage, MemoryEntry, Task } from '@bharat-ai-office/shared';

export const DAEMON_WS_URL = process.env.NEXT_PUBLIC_DAEMON_WS_URL ?? 'ws://localhost:4317/ws';

export interface HiveSocketState {
  connected: boolean;
  agents: Agent[];
  tasks: Task[];
  messages: HiveMessage[];
  escalations: Escalation[];
  memories: MemoryEntry[];
  brief: BriefRecord | null;
  // Per-agent accumulated terminal output, capped, for the employee side panel.
  ptyOutputByAgent: Record<string, string>;
}

const TERMINAL_BUFFER_CAP = 20_000;
const RECONNECT_DELAY_MS = 2000;

const initialState: HiveSocketState = {
  connected: false,
  agents: [],
  tasks: [],
  messages: [],
  escalations: [],
  memories: [],
  brief: null,
  ptyOutputByAgent: {},
};

function applyEvent(prev: HiveSocketState, event: HiveEvent): HiveSocketState {
  switch (event.type) {
    case 'snapshot':
      return {
        ...prev,
        connected: true,
        agents: event.payload.agents,
        tasks: event.payload.tasks,
        messages: event.payload.messages,
        escalations: event.payload.escalations,
        brief: event.payload.brief,
      };
    case 'task:update': {
      const tasks = [...prev.tasks.filter((t) => t.id !== event.payload.id), event.payload];
      return { ...prev, tasks };
    }
    case 'message:new':
      return { ...prev, messages: [event.payload, ...prev.messages].slice(0, 300) };
    case 'escalation:new': {
      const escalations = [event.payload, ...prev.escalations.filter((e) => e.id !== event.payload.id)];
      return { ...prev, escalations };
    }
    case 'escalation:resolved': {
      const escalations = prev.escalations.map((e) => (e.id === event.payload.id ? event.payload : e));
      return { ...prev, escalations };
    }
    case 'memory:new':
      return { ...prev, memories: [event.payload, ...prev.memories].slice(0, 300) };
    case 'brief:update':
      return { ...prev, brief: event.payload };
    case 'pty:output': {
      const key = event.payload.agentId;
      const existing = prev.ptyOutputByAgent[key] ?? '';
      const next = (existing + event.payload.chunk).slice(-TERMINAL_BUFFER_CAP);
      return { ...prev, ptyOutputByAgent: { ...prev.ptyOutputByAgent, [key]: next } };
    }
    case 'pty:exit':
      return prev; // the corresponding task:update already reflects the outcome
    default:
      return prev;
  }
}

/** Keeps agent/task/message/escalation/memory state in sync with the daemon's WebSocket. */
export function useHiveSocket(): HiveSocketState {
  const [state, setState] = useState<HiveSocketState>(initialState);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      const socket = new WebSocket(DAEMON_WS_URL);
      socketRef.current = socket;

      socket.onmessage = (raw) => {
        try {
          const event = JSON.parse(raw.data as string) as HiveEvent;
          setState((prev) => applyEvent(prev, event));
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        setState((prev) => ({ ...prev, connected: false }));
        if (!cancelled) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      socket.onerror = () => socket.close();
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, []);

  return state;
}
