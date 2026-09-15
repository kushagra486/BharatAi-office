import { EMPLOYEE_ROSTER, ROSTER } from '@bharat-ai-office/shared';
import type { HiveMessage, Task } from '@bharat-ai-office/shared';
import * as hive from '../hive/hive';
import { agentRunner } from '../agents/AgentRunner';
import { chatCompleteJson } from '../llm/router';
import { ESCALATION_POLICY, NOVA_SYSTEM_PROMPT } from './prompts';

const POLL_INTERVAL_MS = 4000;

// Nova's coordination calls go through the same multi-provider router every
// employee uses (llm/router.ts) — her assignment (llm/assignments.ts)
// governs which provider/model she reasons on, with automatic fallback if
// it's rate-limited or down.

// --- 1. Brief -> task graph decomposition -----------------------------------

interface TaskGraphTask {
  id: string;
  agentId: string;
  title: string;
  description: string;
  dependsOn?: string[];
}

function estimateEtaMinutes(taskCount: number): number {
  return Math.max(10, taskCount * 4);
}

export async function decomposeBrief(brief: string): Promise<Task[]> {
  hive.setBrief({ brief, status: 'planning' });

  const roster = EMPLOYEE_ROSTER.map((a) => `- ${a.id}: ${a.role} (${a.dept})`).join('\n');
  const prompt = `Project brief:
"""
${brief}
"""

Available employees (agent id: role):
${roster}

Decompose this brief into a task graph. Respond with strict JSON only, no
prose, matching this shape:
{ "tasks": [ { "id": string, "agentId": string, "title": string, "description": string, "dependsOn": string[] } ] }

Rules:
- Task ids are short kebab-case slugs, unique within the graph.
- dependsOn lists other task ids from this same array (empty array if none).
- Assign every task to exactly one employee id from the roster above, by role fit.
- Keep the graph tight: usually 6-14 tasks for a typical brief.
- Order tasks so a reader scanning top-to-bottom sees dependencies before dependents.`;

  const parsed = await chatCompleteJson('nova', NOVA_SYSTEM_PROMPT, prompt);
  const rawTasks = Array.isArray(parsed.tasks) ? (parsed.tasks as TaskGraphTask[]) : [];

  const validAgentIds = new Set(EMPLOYEE_ROSTER.map((a) => a.id));
  const created: Task[] = [];
  for (const t of rawTasks) {
    if (!t.id || !t.agentId || !validAgentIds.has(t.agentId)) continue;
    created.push(
      hive.createTask({
        id: t.id,
        agentId: t.agentId,
        title: t.title ?? t.id,
        description: t.description ?? '',
        dependsOn: t.dependsOn ?? [],
      })
    );
  }

  hive.setBrief({ brief, status: 'in_progress', etaMinutes: estimateEtaMinutes(created.length) });
  return created;
}

// --- 2. Escalation triage loop ------------------------------------------------

const triagedMessageIds = new Set<number>();

interface TriageResult {
  escalate: boolean;
  reason: string;
}

async function triageEscalationMessage(message: HiveMessage): Promise<void> {
  const prompt = `${ESCALATION_POLICY}

An employee (agent id: ${message.from_agent}) flagged this while working a task:
"""
${message.body}
"""

Respond with strict JSON only: { "escalate": boolean, "reason": string }.
"reason" is one or two sentences: if escalate is true, explain what needs
human approval; if false, explain how you're resolving it yourself.`;

  let result: TriageResult;
  try {
    const parsed = await chatCompleteJson('nova', NOVA_SYSTEM_PROMPT, prompt);
    result = {
      escalate: Boolean(parsed.escalate),
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'No reason given.',
    };
  } catch (err) {
    // Groq unreachable or misconfigured — fail safe by surfacing to the human
    // rather than silently swallowing a potential policy-relevant flag.
    result = { escalate: true, reason: `Nova could not reach Groq to triage this (${(err as Error).message}).` };
  }

  if (result.escalate) {
    hive.raiseEscalation({ agentId: message.from_agent, description: `${message.body} — ${result.reason}` });
  } else {
    hive.addMemory({
      agentId: 'nova',
      tag: 'escalation-resolved',
      content: `Auto-resolved for ${message.from_agent}: "${message.body}" → ${result.reason}`,
    });
  }
}

async function runEscalationTriage(): Promise<void> {
  const messages = hive.listMessages({ agentId: 'nova' }).filter((m) => m.to_agent === 'nova' && m.type === 'escalation');
  for (const message of messages) {
    if (triagedMessageIds.has(message.id)) continue;
    triagedMessageIds.add(message.id);
    await triageEscalationMessage(message);
  }
}

// --- 3. Task dispatch: start ready tasks whose dependencies are satisfied ---

function isReady(task: Task, tasksById: Map<string, Task>): boolean {
  if (task.status !== 'idle') return false;
  return task.depends_on.every((depId) => tasksById.get(depId)?.status === 'done');
}

function dispatchReadyTasks(): void {
  const tasks = hive.listTasks();
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  for (const task of tasks) {
    if (!isReady(task, tasksById)) continue;
    if (agentRunner.isBusy(task.agent_id)) continue;
    try {
      agentRunner.startTask(task.agent_id, task.id);
    } catch (err) {
      console.error(`[nova] failed to start task ${task.id} for ${task.agent_id}`, err);
    }
  }
}

// --- 4. QA pass on completion --------------------------------------------------

let qaCompletedForBrief: string | null = null;

async function runQaPassIfComplete(): Promise<void> {
  const brief = hive.getBrief();
  if (!brief || brief.status !== 'in_progress') return;
  if (qaCompletedForBrief === brief.brief) return;

  const tasks = hive.listTasks();
  if (tasks.length === 0 || !tasks.every((t) => t.status === 'done')) return;

  const reports = hive
    .listMessages({ limit: 200 })
    .filter((m) => m.to_agent === 'nova' && m.type === 'report')
    .reverse();
  const reportText = reports.map((r) => `- [${r.from_agent}] ${r.body}`).join('\n') || '(no reports filed)';

  const prompt = `Original brief:
"""
${brief.brief}
"""

Employee reports filed on completed tasks:
${reportText}

Check these outputs for consistency with the brief, then write the final
deliverable summary. Respond with strict JSON only:
{ "consistent": boolean, "summary": string, "concerns": string[] }`;

  let summary = 'QA pass could not run (Groq unreachable).';
  try {
    const parsed = await chatCompleteJson('nova', NOVA_SYSTEM_PROMPT, prompt);
    summary = typeof parsed.summary === 'string' ? parsed.summary : summary;
    const concerns = Array.isArray(parsed.concerns) ? (parsed.concerns as string[]) : [];
    if (concerns.length) {
      summary += `\n\nConcerns:\n${concerns.map((c) => `- ${c}`).join('\n')}`;
    }
  } catch (err) {
    console.error('[nova] QA pass failed', err);
  }

  hive.addMemory({ agentId: 'nova', tag: 'qa-summary', content: summary });
  hive.setBrief({ brief: brief.brief, status: 'complete', etaMinutes: 0 });
  qaCompletedForBrief = brief.brief;
}

// --- run loop ------------------------------------------------------------------

let loopHandle: ReturnType<typeof setInterval> | null = null;

export function startNovaLoop(): void {
  if (loopHandle) return;
  loopHandle = setInterval(() => {
    dispatchReadyTasks();
    void runEscalationTriage();
    void runQaPassIfComplete();
  }, POLL_INTERVAL_MS);
}

export function stopNovaLoop(): void {
  if (loopHandle) clearInterval(loopHandle);
  loopHandle = null;
}

// --- human resolutions from the Approvals Dock ---------------------------------

// The Hive schema (PRD 5.4) doesn't link an escalation to a task id, so the
// "blocked employee" whose work should proceed/stop is found heuristically:
// their most recently created still-blocked task. In practice an agent has
// at most one blocked task at a time (AgentRunner only runs one task per
// agent), so this is unambiguous outside pathological cases.
export async function applyHumanResolution(escalationId: number, resolution: 'approved' | 'denied') {
  const escalation = hive.resolveEscalation(escalationId, resolution);
  const blockedTasks = hive.listTasks({ agentId: escalation.agent_id, status: 'blocked' });
  const task = blockedTasks[blockedTasks.length - 1];

  if (resolution === 'approved') {
    hive.sendMessage({
      fromAgent: 'nova',
      toAgent: escalation.agent_id,
      type: 'report',
      body: `Approved: ${escalation.description}`,
    });
    // There's no live conversation to resume — each task runs as a fresh
    // tool-use loop (see AgentRunner). "Let the blocked employee proceed"
    // becomes: requeue the task as idle so Nova's dispatch loop starts a
    // new run of it on its next tick.
    if (task) hive.updateTaskStatus(task.id, 'idle');
  } else {
    hive.sendMessage({
      fromAgent: 'nova',
      toAgent: escalation.agent_id,
      type: 'report',
      body: `Denied: ${escalation.description}`,
    });
    // Left 'blocked' deliberately — re-running the identical task would
    // just re-raise the same escalation. It stays visible until a human
    // or Nova reassigns/edits it (not automated in v1).
  }

  return escalation;
}

export function novaAgent() {
  return ROSTER.find((a) => a.id === 'nova')!;
}
