'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MESSAGE_COLOR, REVIEW_TABLE_POSITION, ROSTER } from '@bharat-ai-office/shared';
import type { Agent, HiveMessage, MessageType, Task, TaskStatus } from '@bharat-ai-office/shared';
import { DeskSlot } from './DeskSlot';

const WALK_DURATION_MS = 3200;
const ENVELOPE_FLIGHT_MS = 1600;

export interface OfficeFloorProps {
  agents: Agent[];
  tasks: Task[];
  messages: HiveMessage[];
  onSelectAgent: (agentId: string) => void;
}

interface EnvelopeFlight {
  key: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
}

function positionOf(agentId: string): { x: number; y: number } {
  const agent = ROSTER.find((a) => a.id === agentId);
  return agent ? { x: agent.home_x, y: agent.home_y } : REVIEW_TABLE_POSITION;
}

function agentStatus(agentId: string, tasksByAgent: Map<string, Task[]>): TaskStatus {
  const list = tasksByAgent.get(agentId) ?? [];
  if (list.some((t) => t.status === 'blocked')) return 'blocked';
  if (list.some((t) => t.status === 'working')) return 'working';
  if (list.length > 0 && list.every((t) => t.status === 'done')) return 'done';
  return 'idle';
}

export function OfficeFloor({ agents, tasks, messages, onSelectAgent }: OfficeFloorProps) {
  const tasksByAgent = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const list = map.get(task.agent_id) ?? [];
      list.push(task);
      map.set(task.agent_id, list);
    }
    return map;
  }, [tasks]);

  // Walking = a real handoff/done transition just happened for that agent's
  // task, not a timer (PRD Prompt 6) — track previous statuses to detect it.
  const prevTaskStatus = useRef<Record<string, TaskStatus>>({});
  const [walkingAgents, setWalkingAgents] = useState<Set<string>>(new Set());

  useEffect(() => {
    const justCompleted: string[] = [];
    for (const task of tasks) {
      const prev = prevTaskStatus.current[task.id];
      if (prev && prev !== 'done' && task.status === 'done') {
        justCompleted.push(task.agent_id);
      }
      prevTaskStatus.current[task.id] = task.status;
    }
    if (justCompleted.length === 0) return;

    setWalkingAgents((prev) => new Set([...prev, ...justCompleted]));
    const timer = setTimeout(() => {
      setWalkingAgents((prev) => {
        const next = new Set(prev);
        justCompleted.forEach((id) => next.delete(id));
        return next;
      });
    }, WALK_DURATION_MS);
    return () => clearTimeout(timer);
  }, [tasks]);

  // Envelope flights = message-only handoffs (PRD section 4): fire on
  // message:new, colored by message type, distinct from walking.
  const seenMessageIds = useRef<Set<number>>(new Set());
  const [flights, setFlights] = useState<EnvelopeFlight[]>([]);

  useEffect(() => {
    const fresh = messages.filter((m) => !seenMessageIds.current.has(m.id)).slice(0, 6);
    if (fresh.length === 0) return;
    fresh.forEach((m) => seenMessageIds.current.add(m.id));

    const newFlights = fresh.map((m) => ({
      key: `${m.id}`,
      from: positionOf(m.from_agent),
      to: positionOf(m.to_agent),
      color: MESSAGE_COLOR[m.type as MessageType] ?? MESSAGE_COLOR.task,
    }));
    setFlights((prev) => [...prev, ...newFlights]);

    const timer = setTimeout(() => {
      setFlights((prev) => prev.filter((f) => !newFlights.some((nf) => nf.key === f.key)));
    }, ENVELOPE_FLIGHT_MS + 200);
    return () => clearTimeout(timer);
  }, [messages]);

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-line bg-panel">
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {agents
          .filter((a) => a.id !== 'nova')
          .map((a) => (
            <line
              key={a.id}
              x1={a.home_x}
              y1={a.home_y}
              x2={REVIEW_TABLE_POSITION.x}
              y2={REVIEW_TABLE_POSITION.y}
              stroke="#1D2836"
              strokeWidth={0.3}
              strokeDasharray="1 1.6"
            />
          ))}
        {flights.map((flight) => (
          <circle key={flight.key} r={1.1} fill={flight.color}>
            <animateMotion
              dur={`${ENVELOPE_FLIGHT_MS}ms`}
              fill="freeze"
              path={`M ${flight.from.x} ${flight.from.y} L ${flight.to.x} ${flight.to.y}`}
            />
          </circle>
        ))}
      </svg>

      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-amber/40 bg-amber/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-amber"
        style={{ left: `${REVIEW_TABLE_POSITION.x}%`, top: `${REVIEW_TABLE_POSITION.y}%` }}
      >
        Review Table
      </div>

      {agents.map((agent) => (
        <DeskSlot
          key={agent.id}
          agent={agent}
          status={agent.id === 'nova' ? 'idle' : agentStatus(agent.id, tasksByAgent)}
          walking={walkingAgents.has(agent.id)}
          onSelect={() => onSelectAgent(agent.id)}
        />
      ))}
    </div>
  );
}
