'use client';

import { useEffect, useRef, useState } from 'react';
import type { Agent, BriefRecord, Escalation, HiveMessage, Task } from '@bharat-ai-office/shared';
import { getAuthStatus, getBrief, listAgents, listEscalations, listMessages, listTasks } from '@/lib/daemonApi';
import { getToken } from '@/lib/authToken';
import { getSupabaseClient } from '@/lib/supabaseClient';

export interface HiveSocketState {
  connected: boolean;
  agents: Agent[];
  tasks: Task[];
  messages: HiveMessage[];
  escalations: Escalation[];
  brief: BriefRecord | null;
  // Per-agent accumulated terminal output, capped, for the employee side panel.
  agentOutputByAgent: Record<string, string>;
}

const TERMINAL_BUFFER_CAP = 20_000;

const initialState: HiveSocketState = {
  connected: false,
  agents: [],
  tasks: [],
  messages: [],
  escalations: [],
  brief: null,
  agentOutputByAgent: {},
};

/**
 * Keeps agent/task/message/escalation/brief state in sync with Supabase —
 * a one-shot fetch of the current state via the Next.js API routes (which
 * enforce the login gate), then Supabase Realtime for live updates. This
 * replaces the old raw WebSocket connection to the daemon: there's no
 * long-lived daemon process to hold that socket open anymore, but Postgres
 * changes on tasks/messages/escalations/brief are published to Realtime
 * directly (see the initial_hive_schema migration), so the effect is the
 * same. The employee side panel's live terminal feed (agent:output/
 * agent:exit) rides a separate Realtime *broadcast* channel instead of a
 * table — those chunks are high-frequency and not meant to be queried or
 * persisted, so a table+postgres_changes would be the wrong tool; the
 * persistent worker publishes them directly (see worker/src/dispatch.ts).
 */
export function useHiveSocket(): HiveSocketState {
  const [state, setState] = useState<HiveSocketState>(initialState);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    (async () => {
      // A login is required and this browser has no token yet — don't even
      // attempt the initial fetch (it would just 401); useAuthGuard handles
      // the redirect to /login.
      try {
        const status = await getAuthStatus();
        if (status.authRequired && !getToken()) return;
      } catch {
        return; // daemon/API unreachable — HUD's connected dot already reflects this
      }

      try {
        const [agents, tasks, messages, escalations, brief] = await Promise.all([
          listAgents(),
          listTasks(),
          listMessages(),
          listEscalations(),
          getBrief(),
        ]);
        if (cancelledRef.current) return;
        setState((prev) => ({ ...prev, connected: true, agents, tasks, messages, escalations, brief }));
      } catch (err) {
        console.error('[useHiveSocket] initial fetch failed', err);
      }
    })();

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('hive-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        const task = payload.new as Task;
        setState((prev) => ({ ...prev, tasks: [...prev.tasks.filter((t) => t.id !== task.id), task] }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const message = payload.new as HiveMessage;
        setState((prev) => ({ ...prev, messages: [message, ...prev.messages].slice(0, 300) }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escalations' }, (payload) => {
        const escalation = payload.new as Escalation;
        setState((prev) => ({
          ...prev,
          escalations: [escalation, ...prev.escalations.filter((e) => e.id !== escalation.id)],
        }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brief' }, (payload) => {
        const row = payload.new as { brief: string; eta_minutes: number | null; status: string; created_at: string };
        setState((prev) => ({
          ...prev,
          brief: { brief: row.brief, etaMinutes: row.eta_minutes, status: row.status, createdAt: row.created_at },
        }));
      })
      .on('broadcast', { event: 'output' }, ({ payload }) => {
        const { agentId, chunk } = payload as { agentId: string; taskId: string; chunk: string };
        setState((prev) => {
          const existing = prev.agentOutputByAgent[agentId] ?? '';
          const next = (existing + chunk).slice(-TERMINAL_BUFFER_CAP);
          return { ...prev, agentOutputByAgent: { ...prev.agentOutputByAgent, [agentId]: next } };
        });
      })
      .subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') setState((prev) => ({ ...prev, connected: true }));
        if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
          setState((prev) => ({ ...prev, connected: false }));
        }
      });

    return () => {
      cancelledRef.current = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return state;
}
