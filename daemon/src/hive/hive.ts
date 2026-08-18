import { EventEmitter } from 'node:events';
import { db } from './db';
import type {
  Agent,
  BriefRecord,
  Escalation,
  EscalationResolution,
  HiveEvent,
  HiveMessage,
  MemoryEntry,
  MessageType,
  Task,
  TaskStatus,
} from '@bharat-ai-office/shared';

// Every Hive write emits a typed HiveEvent on this bus. The WebSocket
// bridge (Phase 4) is the sole subscriber that fans these out to clients,
// keeping hive.ts itself transport-agnostic.
export const hiveEvents = new EventEmitter();

function emit(event: HiveEvent) {
  hiveEvents.emit('hive-event', event);
}

function nowIso(): string {
  return new Date().toISOString();
}

// --- agents ----------------------------------------------------------------

export function listAgents(): Agent[] {
  return db.prepare('SELECT * FROM agents').all() as Agent[];
}

// --- tasks -------------------------------------------------------------------

interface TaskRow {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  depends_on: string;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return { ...row, depends_on: JSON.parse(row.depends_on) as string[] };
}

export function createTask(input: {
  id: string;
  agentId: string;
  title: string;
  description: string;
  dependsOn?: string[];
  status?: TaskStatus;
}): Task {
  const ts = nowIso();
  const row: TaskRow = {
    id: input.id,
    agent_id: input.agentId,
    title: input.title,
    description: input.description,
    status: input.status ?? 'idle',
    depends_on: JSON.stringify(input.dependsOn ?? []),
    created_at: ts,
    updated_at: ts,
  };
  db.prepare(`
    INSERT INTO tasks (id, agent_id, title, description, status, depends_on, created_at, updated_at)
    VALUES (@id, @agent_id, @title, @description, @status, @depends_on, @created_at, @updated_at)
  `).run(row);
  const task = rowToTask(row);
  emit({ type: 'task:update', payload: task });
  return task;
}

export function updateTaskStatus(taskId: string, status: TaskStatus): Task {
  const updated_at = nowIso();
  db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(status, updated_at, taskId);
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
  if (!row) throw new Error(`task not found: ${taskId}`);
  const task = rowToTask(row);
  emit({ type: 'task:update', payload: task });
  return task;
}

export function listTasks(filter?: { agentId?: string; status?: TaskStatus }): Task[] {
  let query = 'SELECT * FROM tasks';
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  if (filter?.agentId) {
    clauses.push('agent_id = @agentId');
    params.agentId = filter.agentId;
  }
  if (filter?.status) {
    clauses.push('status = @status');
    params.status = filter.status;
  }
  if (clauses.length) query += ' WHERE ' + clauses.join(' AND ');
  query += ' ORDER BY created_at ASC';
  const rows = db.prepare(query).all(params) as TaskRow[];
  return rows.map(rowToTask);
}

export function getTask(taskId: string): Task | undefined {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
  return row ? rowToTask(row) : undefined;
}

// --- messages (mailbox) -----------------------------------------------------

export function sendMessage(input: {
  fromAgent: string;
  toAgent: string;
  type: MessageType;
  body: string;
}): HiveMessage {
  const created_at = nowIso();
  const info = db
    .prepare('INSERT INTO messages (from_agent, to_agent, type, body, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(input.fromAgent, input.toAgent, input.type, input.body, created_at);
  const message: HiveMessage = {
    id: Number(info.lastInsertRowid),
    from_agent: input.fromAgent,
    to_agent: input.toAgent,
    type: input.type,
    body: input.body,
    created_at,
  };
  emit({ type: 'message:new', payload: message });
  return message;
}

export function listMessages(filter?: { agentId?: string; limit?: number }): HiveMessage[] {
  let query = 'SELECT * FROM messages';
  const params: Record<string, string | number> = {};
  if (filter?.agentId) {
    query += ' WHERE from_agent = @agentId OR to_agent = @agentId';
    params.agentId = filter.agentId;
  }
  query += ' ORDER BY created_at DESC';
  if (filter?.limit) {
    query += ' LIMIT @limit';
    params.limit = filter.limit;
  }
  return db.prepare(query).all(params) as HiveMessage[];
}

// --- memory ------------------------------------------------------------------

export function addMemory(input: { agentId: string; tag: string; content: string }): MemoryEntry {
  const created_at = nowIso();
  const info = db
    .prepare('INSERT INTO memory (agent_id, tag, content, created_at) VALUES (?, ?, ?, ?)')
    .run(input.agentId, input.tag, input.content, created_at);
  const entry: MemoryEntry = {
    id: Number(info.lastInsertRowid),
    agent_id: input.agentId,
    tag: input.tag,
    content: input.content,
    created_at,
  };
  emit({ type: 'memory:new', payload: entry });
  return entry;
}

export function searchMemory(query: string, limit = 50): MemoryEntry[] {
  if (!query.trim()) {
    return db.prepare('SELECT * FROM memory ORDER BY created_at DESC LIMIT ?').all(limit) as MemoryEntry[];
  }
  const like = `%${query}%`;
  return db
    .prepare(
      `SELECT * FROM memory
       WHERE content LIKE @like OR tag LIKE @like OR agent_id LIKE @like
       ORDER BY created_at DESC LIMIT @limit`
    )
    .all({ like, limit }) as MemoryEntry[];
}

// --- escalations (approvals dock) --------------------------------------------

export function raiseEscalation(input: { agentId: string; description: string }): Escalation {
  const created_at = nowIso();
  const info = db
    .prepare('INSERT INTO escalations (agent_id, description, resolution, created_at) VALUES (?, ?, ?, ?)')
    .run(input.agentId, input.description, 'pending', created_at);
  const escalation: Escalation = {
    id: Number(info.lastInsertRowid),
    agent_id: input.agentId,
    description: input.description,
    resolution: 'pending',
    created_at,
    resolved_at: null,
  };
  emit({ type: 'escalation:new', payload: escalation });
  return escalation;
}

export function resolveEscalation(id: number, resolution: Exclude<EscalationResolution, 'pending'>): Escalation {
  const resolved_at = nowIso();
  db.prepare('UPDATE escalations SET resolution = ?, resolved_at = ? WHERE id = ?').run(resolution, resolved_at, id);
  const escalation = db.prepare('SELECT * FROM escalations WHERE id = ?').get(id) as Escalation | undefined;
  if (!escalation) throw new Error(`escalation not found: ${id}`);
  emit({ type: 'escalation:resolved', payload: escalation });
  return escalation;
}

export function listEscalations(filter?: { resolution?: EscalationResolution }): Escalation[] {
  let query = 'SELECT * FROM escalations';
  const params: Record<string, string> = {};
  if (filter?.resolution) {
    query += ' WHERE resolution = @resolution';
    params.resolution = filter.resolution;
  }
  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(params) as Escalation[];
}

// --- brief (current project brief + status, drives the Brief Strip) --------

export function setBrief(input: { brief: string; etaMinutes?: number | null; status?: string }): BriefRecord {
  const ts = nowIso();
  db.prepare(`
    INSERT INTO brief (id, brief, eta_minutes, status, created_at, updated_at)
    VALUES (1, @brief, @eta_minutes, @status, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      brief = excluded.brief, eta_minutes = excluded.eta_minutes,
      status = excluded.status, updated_at = excluded.updated_at
  `).run({
    brief: input.brief,
    eta_minutes: input.etaMinutes ?? null,
    status: input.status ?? 'planning',
    created_at: ts,
    updated_at: ts,
  });
  const record = getBrief()!;
  emit({ type: 'brief:update', payload: record });
  return record;
}

export function getBrief(): BriefRecord | undefined {
  const row = db.prepare('SELECT brief, eta_minutes as etaMinutes, status FROM brief WHERE id = 1').get() as
    | BriefRecord
    | undefined;
  return row;
}
