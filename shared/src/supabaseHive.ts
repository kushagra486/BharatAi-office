import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Agent,
  BriefRecord,
  Escalation,
  EscalationResolution,
  HiveMessage,
  MemoryEntry,
  MessageType,
  ProjectFile,
  Task,
  TaskStatus,
} from './hive-types';

// Replaces daemon/src/hive/hive.ts's better-sqlite3 calls for the
// serverless migration. No EventEmitter here (the old hive.ts's
// hiveEvents bus) — Postgres changes on tasks/messages/escalations/brief
// are published to Supabase Realtime directly (see the initial_hive_schema
// migration's `alter publication supabase_realtime add table ...`), so
// subscribers get updates from the database itself, not from this module.
//
// Prefers the service_role key, which bypasses Row Level Security — this
// module must only ever run server-side (Next.js API routes, the
// persistent worker), never in browser code. SUPABASE_SERVICE_ROLE_KEY is
// deliberately not prefixed NEXT_PUBLIC_ so Next.js keeps it out of the
// client bundle.
//
// Falls back to the anon/publishable key when the service role key isn't
// configured yet, so read-only routes (agents/tasks/messages/escalations/
// brief/memory — every table with a "public read" RLS policy from the
// initial_hive_schema migration) keep working in a degraded read-only mode
// instead of 500ing outright. Anything that writes, or reads a
// service-role-only table (sessions, rate_limit_windows, llm_usage), still
// fails under RLS until the real service role key is set — that failure is
// expected and correctly surfaces the missing secret rather than masking it.
let client: SupabaseClient | null = null;

/** Shared across every server-side module that needs Postgres (auth.ts, rateLimiter.ts, this file) — one client, one connection pool. */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceRoleKey || anonKey;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY) must be set (server-side only)');
  }
  if (!serviceRoleKey) {
    console.warn(
      '[supabaseHive] SUPABASE_SERVICE_ROLE_KEY is not set — falling back to the anon key. ' +
        'Reads on publicly-readable tables work via RLS; writes and service-role-only tables will fail until the real key is configured.'
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

function orThrow<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('expected a row but got none');
  return data;
}

// --- agents ------------------------------------------------------------------

export async function listAgents(): Promise<Agent[]> {
  return orThrow(await db().from('agents').select('*'));
}

// --- tasks ---------------------------------------------------------------------

export async function createTask(input: {
  id: string;
  agentId: string;
  title: string;
  description: string;
  dependsOn?: string[];
  status?: TaskStatus;
}): Promise<Task> {
  return orThrow<Task>(
    await db()
      .from('tasks')
      .insert({
        id: input.id,
        agent_id: input.agentId,
        title: input.title,
        description: input.description,
        status: input.status ?? 'idle',
        depends_on: input.dependsOn ?? [],
      })
      .select()
      .single()
  );
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  return orThrow<Task>(
    await db()
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .single()
  );
}

export async function listTasks(filter?: { agentId?: string; status?: TaskStatus }): Promise<Task[]> {
  let query = db().from('tasks').select('*').order('created_at', { ascending: true });
  if (filter?.agentId) query = query.eq('agent_id', filter.agentId);
  if (filter?.status) query = query.eq('status', filter.status);
  return orThrow(await query);
}

export async function getTask(taskId: string): Promise<Task | undefined> {
  const { data, error } = await db().from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? undefined;
}

// --- messages (mailbox) -----------------------------------------------------

export async function sendMessage(input: {
  fromAgent: string;
  toAgent: string;
  type: MessageType;
  body: string;
}): Promise<HiveMessage> {
  return orThrow<HiveMessage>(
    await db()
      .from('messages')
      .insert({ from_agent: input.fromAgent, to_agent: input.toAgent, type: input.type, body: input.body })
      .select()
      .single()
  );
}

export async function listMessages(filter?: { agentId?: string; limit?: number }): Promise<HiveMessage[]> {
  let query = db().from('messages').select('*').order('created_at', { ascending: false });
  if (filter?.agentId) query = query.or(`from_agent.eq.${filter.agentId},to_agent.eq.${filter.agentId}`);
  if (filter?.limit) query = query.limit(filter.limit);
  return orThrow(await query);
}

/**
 * Escalation messages to Nova that haven't been triaged yet — replaces the
 * old in-memory triagedMessageIds Set (daemon/src/nova/nova.ts), which only
 * worked because Nova's loop ran inside one long-lived process. A
 * serverless scheduled function gets a fresh invocation each time, so
 * "already handled" has to be a real column (messages.handled_at) instead.
 */
export async function listUnhandledEscalationMessages(): Promise<HiveMessage[]> {
  return orThrow(
    await db()
      .from('messages')
      .select('*')
      .eq('to_agent', 'nova')
      .eq('type', 'escalation')
      .is('handled_at', null)
      .order('created_at', { ascending: true })
  );
}

export async function markMessageHandled(id: number): Promise<void> {
  const { error } = await db().from('messages').update({ handled_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// --- memory --------------------------------------------------------------------

export async function addMemory(input: { agentId: string; tag: string; content: string }): Promise<MemoryEntry> {
  return orThrow<MemoryEntry>(
    await db()
      .from('memory')
      .insert({ agent_id: input.agentId, tag: input.tag, content: input.content })
      .select()
      .single()
  );
}

export async function searchMemory(query: string, limit = 50): Promise<MemoryEntry[]> {
  let q = db().from('memory').select('*').order('created_at', { ascending: false }).limit(limit);
  if (query.trim()) {
    const like = `%${query}%`;
    q = q.or(`content.ilike.${like},tag.ilike.${like},agent_id.ilike.${like}`);
  }
  return orThrow(await q);
}

// --- escalations (approvals dock) --------------------------------------------

export async function raiseEscalation(input: { agentId: string; description: string }): Promise<Escalation> {
  return orThrow<Escalation>(
    await db()
      .from('escalations')
      .insert({ agent_id: input.agentId, description: input.description, resolution: 'pending' })
      .select()
      .single()
  );
}

export async function resolveEscalation(
  id: number,
  resolution: Exclude<EscalationResolution, 'pending'>
): Promise<Escalation> {
  return orThrow<Escalation>(
    await db()
      .from('escalations')
      .update({ resolution, resolved_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  );
}

export async function listEscalations(filter?: { resolution?: EscalationResolution }): Promise<Escalation[]> {
  let query = db().from('escalations').select('*').order('created_at', { ascending: false });
  if (filter?.resolution) query = query.eq('resolution', filter.resolution);
  return orThrow(await query);
}

// --- brief (current project brief + status, drives the Brief Strip) --------

interface BriefRow {
  brief: string;
  eta_minutes: number | null;
  status: string;
  created_at: string;
}

function rowToBrief(row: BriefRow): BriefRecord {
  return { brief: row.brief, etaMinutes: row.eta_minutes, status: row.status, createdAt: row.created_at };
}

export async function setBrief(input: { brief: string; etaMinutes?: number | null; status?: string }): Promise<BriefRecord> {
  const row = orThrow<BriefRow>(
    await db()
      .from('brief')
      .upsert(
        { id: 1, brief: input.brief, eta_minutes: input.etaMinutes ?? null, status: input.status ?? 'planning', updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .select('brief, eta_minutes, status, created_at')
      .single()
  );
  return rowToBrief(row);
}

export async function getBrief(): Promise<BriefRecord | undefined> {
  const { data, error } = await db().from('brief').select('brief, eta_minutes, status, created_at').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToBrief(data as BriefRow) : undefined;
}

/**
 * Abandons the current project: clears its tasks, mailbox messages, and the
 * brief row itself, so the Brief Strip's composer reopens immediately. Any
 * task still `working` belongs to an in-flight AgentRunner loop on the
 * persistent worker that this can't reach — deleting its row here just
 * means the worker's eventual `updateTaskStatus`/`sendMessage` call for it
 * fails silently against a missing row, which is fine (its result is
 * simply discarded).
 */
export async function clearProject(): Promise<void> {
  const { error: messagesError } = await db().from('messages').delete().neq('id', 0);
  if (messagesError) throw new Error(messagesError.message);
  const { error: tasksError } = await db().from('tasks').delete().neq('id', '');
  if (tasksError) throw new Error(tasksError.message);
  const { error: briefError } = await db().from('brief').delete().eq('id', 1);
  if (briefError) throw new Error(briefError.message);
  // Best-effort: an abandoned project's downloadable files shouldn't linger
  // for the next one, but a Storage hiccup here shouldn't block the
  // composer from reopening — the DB rows above are what actually matters.
  try {
    await clearProjectFiles();
  } catch (err) {
    console.error('[supabaseHive] failed to clear project-files storage during abandon', err);
  }
  try {
    await clearTaskDiffs();
  } catch (err) {
    console.error('[supabaseHive] failed to clear project-diffs storage during abandon', err);
  }
}

// --- project files (Supabase Storage) ---------------------------------------
//
// Mirrors each agent's committed work into Storage so the frontend's Files
// tab can list/download without touching the worker's filesystem directly
// (the worker has no HTTP server — see daemon/src/index.ts). Uploaded by
// AgentRunner right after a successful git commit, keyed by the same
// "{agentId}/relative/path" the commit touched.

const PROJECT_FILES_BUCKET = 'project-files';

export async function uploadProjectFile(path: string, content: Uint8Array, contentType?: string): Promise<void> {
  const { error } = await db()
    .storage.from(PROJECT_FILES_BUCKET)
    .upload(path, content, { contentType: contentType ?? 'application/octet-stream', upsert: true });
  if (error) throw new Error(error.message);
}

// Storage .list() only returns one directory level at a time. Uploaded paths
// are always exactly "{agentId}/{relativePath}", so one call for the
// top-level (agent id folders) plus one nested call per folder covers every
// file — this deliberately doesn't recurse further, since agent workdirs
// are small single-project deliverables (a handful of files/assets), not
// deep source trees.
export async function listProjectFiles(): Promise<ProjectFile[]> {
  const storage = db().storage.from(PROJECT_FILES_BUCKET);
  const { data: topLevel, error } = await storage.list('', { limit: 1000 });
  if (error) throw new Error(error.message);

  const files: ProjectFile[] = [];
  for (const entry of topLevel ?? []) {
    if (entry.id !== null) continue; // a stray top-level file, not an agent folder — ignore
    const { data: nested, error: nestedError } = await storage.list(entry.name, { limit: 1000 });
    if (nestedError) throw new Error(nestedError.message);
    for (const file of nested ?? []) {
      if (file.id === null) continue; // a subfolder one level deeper — not supported, skip
      files.push({
        path: `${entry.name}/${file.name}`,
        size: (file.metadata?.size as number | undefined) ?? 0,
        updatedAt: file.updated_at ?? file.created_at ?? '',
      });
    }
  }
  return files;
}

/** A short-lived signed URL — the bucket is private, so this is the only way to fetch a file's content. */
export async function getProjectFileDownloadUrl(path: string): Promise<string> {
  const { data, error } = await db().storage.from(PROJECT_FILES_BUCKET).createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function clearProjectFiles(): Promise<void> {
  const files = await listProjectFiles();
  if (files.length === 0) return;
  const { error } = await db()
    .storage.from(PROJECT_FILES_BUCKET)
    .remove(files.map((f) => f.path));
  if (error) throw new Error(error.message);
}

// --- task diffs (Supabase Storage) -------------------------------------------
//
// A separate bucket from project-files (not folded into it) — a diff isn't
// a deliverable, it's an audit/preview artifact, and project-files' listing
// logic treats every top-level folder as an agent id, which a "diffs"
// folder would falsely masquerade as. Keyed by taskId, not agentId, since
// that's what the Automation panel looks it up by (a task -> what changed
// to finish it).

const PROJECT_DIFFS_BUCKET = 'project-diffs';

export async function uploadTaskDiff(taskId: string, diff: string): Promise<void> {
  if (!diff.trim()) return; // nothing changed (shouldn't normally happen for a 'done' outcome, but not worth erroring over)
  const { error } = await db()
    .storage.from(PROJECT_DIFFS_BUCKET)
    .upload(`${taskId}.diff`, diff, { contentType: 'text/plain', upsert: true });
  if (error) throw new Error(error.message);
}

/** A short-lived signed URL for a task's diff text, or undefined if this task has none (still running, failed before committing, or predates this feature). */
export async function getTaskDiffUrl(taskId: string): Promise<string | undefined> {
  const { data, error } = await db().storage.from(PROJECT_DIFFS_BUCKET).createSignedUrl(`${taskId}.diff`, 300);
  if (error) return undefined; // object not found is the expected case, not a real error
  return data.signedUrl;
}

export async function clearTaskDiffs(): Promise<void> {
  const { data, error } = await db().storage.from(PROJECT_DIFFS_BUCKET).list('', { limit: 1000 });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return;
  const { error: removeError } = await db()
    .storage.from(PROJECT_DIFFS_BUCKET)
    .remove(data.map((f) => f.name));
  if (removeError) throw new Error(removeError.message);
}
