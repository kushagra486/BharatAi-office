import { EMPLOYEE_ROSTER, ROSTER } from '../roster';
import type { HiveMessage, Task } from '../hive-types';
import * as hive from '../supabaseHive';
import { chatCompleteJson } from '../llm/router';
import { ESCALATION_POLICY, NOVA_SYSTEM_PROMPT } from './prompts';

// Nova's coordination calls go through the same multi-provider router every
// employee uses (llm/router.ts) — her assignment (llm/assignments.ts)
// governs which provider/model she reasons on, with automatic fallback if
// it's rate-limited or down.
//
// This module no longer owns a poll loop or task dispatch (the old
// dispatchReadyTasks + startNovaLoop) — those required calling agentRunner
// directly in the same process, which doesn't work once Nova runs as a
// serverless scheduled function and AgentRunner runs on a separate
// persistent worker (worker/src/dispatch.ts owns ready-task selection now,
// reading the same Postgres tasks table). What's left here is exactly the
// LLM-reasoning surface: decompose a brief, triage an escalation, run the
// QA pass, and apply a human's approve/deny — called either directly by
// API routes (decomposeBrief, applyHumanResolution) or periodically by the
// scheduled function (runEscalationTriage, runQaPassIfComplete).

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
  await hive.setBrief({ brief, status: 'planning' });

  const roster = EMPLOYEE_ROSTER.map((a) => `- ${a.id}: ${a.role} (${a.dept})`).join('\n');
  const prompt = `Project brief:
"""
${brief}
"""

Available employees (agent id: role):
${roster}

Decompose this brief into a task graph. Respond with strict JSON only, no
prose, matching this shape:
{ "reasoning": string, "tasks": [ { "id": string, "agentId": string, "title": string, "description": string, "dependsOn": string[] } ] }

"reasoning" comes first: briefly think through what the brief actually
needs and how to split it before listing tasks.

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
      await hive.createTask({
        id: t.id,
        agentId: t.agentId,
        title: t.title ?? t.id,
        description: t.description ?? '',
        dependsOn: t.dependsOn ?? [],
      })
    );
  }

  await hive.setBrief({ brief, status: 'in_progress', etaMinutes: estimateEtaMinutes(created.length) });
  return created;
}

// --- 2. Escalation triage ------------------------------------------------------

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

Respond with strict JSON only: { "reasoning": string, "escalate": boolean, "reason": string }.
"reasoning" comes first — weigh this against the escalation policy in a
sentence before deciding. "reason" is one or two sentences: if escalate is
true, explain what needs human approval; if false, explain how you're
resolving it yourself.`;

  let result: TriageResult;
  try {
    const parsed = await chatCompleteJson('nova', NOVA_SYSTEM_PROMPT, prompt);
    result = {
      escalate: Boolean(parsed.escalate),
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'No reason given.',
    };
  } catch (err) {
    // Provider unreachable or misconfigured — fail safe by surfacing to the
    // human rather than silently swallowing a potential policy-relevant flag.
    result = { escalate: true, reason: `Nova could not reach the LLM provider to triage this (${(err as Error).message}).` };
  }

  if (result.escalate) {
    await hive.raiseEscalation({ agentId: message.from_agent, description: `${message.body} — ${result.reason}` });
  } else {
    await hive.addMemory({
      agentId: 'nova',
      tag: 'escalation-resolved',
      content: `Auto-resolved for ${message.from_agent}: "${message.body}" → ${result.reason}`,
    });
  }
}

/** Called on each scheduled-function tick — processes every not-yet-triaged escalation, oldest first. */
export async function runEscalationTriage(): Promise<void> {
  const messages = await hive.listUnhandledEscalationMessages();
  for (const message of messages) {
    await triageEscalationMessage(message);
    await hive.markMessageHandled(message.id); // marked after processing, not before, so a crash mid-triage retries it next tick
  }
}

// --- 3. QA pass on completion --------------------------------------------------

export async function runQaPassIfComplete(): Promise<void> {
  const brief = await hive.getBrief();
  if (!brief || brief.status !== 'in_progress') return;

  const tasks = await hive.listTasks();
  if (tasks.length === 0 || !tasks.every((t) => t.status === 'done')) return;

  const reports = (await hive.listMessages({ limit: 200 })).filter((m) => m.to_agent === 'nova' && m.type === 'report').reverse();
  const reportText = reports.map((r) => `- [${r.from_agent}] ${r.body}`).join('\n') || '(no reports filed)';

  const prompt = `Original brief:
"""
${brief.brief}
"""

Employee reports filed on completed tasks:
${reportText}

Check these outputs for consistency with the brief, then write the final
deliverable summary. Respond with strict JSON only:
{ "reasoning": string, "consistent": boolean, "summary": string, "concerns": string[] }

"reasoning" comes first: briefly check the reports against the brief
before deciding.`;

  let summary = 'QA pass could not run (LLM provider unreachable).';
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

  await hive.addMemory({ agentId: 'nova', tag: 'qa-summary', content: summary });
  // Flips status to 'complete' immediately, which is itself the guard
  // against re-running: the `brief.status !== 'in_progress'` check above
  // will short-circuit on the next tick. No separate in-memory dedupe
  // needed (the old qaCompletedForBrief) now that this runs as
  // infrequent, non-overlapping scheduled ticks rather than a 4s loop.
  await hive.setBrief({ brief: brief.brief, status: 'complete', etaMinutes: 0 });
}

// --- human resolutions from the Approvals Dock ---------------------------------

// The Hive schema (PRD 5.4) doesn't link an escalation to a task id, so the
// "blocked employee" whose work should proceed/stop is found heuristically:
// their most recently created still-blocked task. In practice an agent has
// at most one blocked task at a time (AgentRunner only runs one task per
// agent), so this is unambiguous outside pathological cases.
export async function applyHumanResolution(escalationId: number, resolution: 'approved' | 'denied') {
  const escalation = await hive.resolveEscalation(escalationId, resolution);
  const blockedTasks = await hive.listTasks({ agentId: escalation.agent_id, status: 'blocked' });
  const task = blockedTasks[blockedTasks.length - 1];

  if (resolution === 'approved') {
    await hive.sendMessage({
      fromAgent: 'nova',
      toAgent: escalation.agent_id,
      type: 'report',
      body: `Approved: ${escalation.description}`,
    });
    // There's no live conversation to resume — each task runs as a fresh
    // tool-use loop (see AgentRunner). "Let the blocked employee proceed"
    // becomes: requeue the task as idle so the worker's dispatch loop
    // starts a new run of it on its next poll.
    if (task) await hive.updateTaskStatus(task.id, 'idle');
  } else {
    await hive.sendMessage({
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
