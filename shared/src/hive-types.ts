// Typed mirrors of the Hive SQLite schema (see daemon/src/hive/schema.sql).
// Shared between daemon and frontend so WebSocket payloads are type-safe end to end.

export type TaskStatus = 'idle' | 'working' | 'blocked' | 'done';
export type MessageType = 'task' | 'handoff' | 'escalation' | 'report';
export type EscalationResolution = 'pending' | 'approved' | 'denied';

export interface Agent {
  id: string;
  name: string;
  role: string;
  dept: string;
  color: string;
  shape: 'hex' | 'diamond' | 'circle' | 'rounded-sq' | 'octagon';
  home_x: number;
  home_y: number;
}

// A file an agent has committed to the project's git repo, mirrored into
// Supabase Storage (bucket "project-files") so the frontend can list and
// download it without needing direct access to the worker's filesystem.
export interface ProjectFile {
  path: string; // "{agentId}/relative/path/in/that/agent's/workdir"
  size: number;
  updatedAt: string;
}

export interface Task {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  depends_on: string[]; // parsed from JSON column
  created_at: string;
  updated_at: string;
}

export interface HiveMessage {
  id: number;
  from_agent: string;
  to_agent: string;
  type: MessageType;
  body: string;
  created_at: string;
}

export interface MemoryEntry {
  id: number;
  agent_id: string;
  tag: string;
  content: string;
  created_at: string;
}

export interface Escalation {
  id: number;
  agent_id: string;
  description: string;
  resolution: EscalationResolution;
  created_at: string;
  resolved_at: string | null;
}

// --- WebSocket event envelope -------------------------------------------

export interface BriefRecord {
  brief: string;
  etaMinutes: number | null;
  status: string;
  // Identifies which project this is — the `brief` row is a singleton
  // (id=1) that gets deleted and re-created fresh on each new project
  // (see supabaseHive.clearProject/setBrief), so createdAt changing is how
  // the worker notices a new project started and resets its local workdir.
  createdAt: string;
}

export interface HiveSnapshot {
  agents: Agent[];
  tasks: Task[];
  messages: HiveMessage[];
  escalations: Escalation[];
  brief: BriefRecord | null;
}

export type HiveEvent =
  | { type: 'snapshot'; payload: HiveSnapshot }
  | { type: 'task:update'; payload: Task }
  | { type: 'message:new'; payload: HiveMessage }
  | { type: 'escalation:new'; payload: Escalation }
  | { type: 'escalation:resolved'; payload: Escalation }
  | { type: 'memory:new'; payload: MemoryEntry }
  | { type: 'brief:update'; payload: BriefRecord }
  // Employee side panel terminal feed — sourced from AgentRunner's
  // agentEvents, not the Hive tables, but broadcast on the same socket.
  | { type: 'agent:output'; payload: { agentId: string; taskId: string; chunk: string } }
  | { type: 'agent:exit'; payload: { agentId: string; taskId: string; exitCode: number } };
