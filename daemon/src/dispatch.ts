import type { Task } from '@bharat-ai-office/shared';
import { ROSTER } from '@bharat-ai-office/shared';
import { supabaseHive as hive } from '@bharat-ai-office/shared/server';
import { agentRunner } from './agents/AgentRunner';
import { env } from './env';

// Replaces the ready-task-selection half of the old daemon/src/nova/nova.ts's
// dispatchReadyTasks — the LLM-reasoning half (escalation triage, QA pass)
// moved to a Netlify Scheduled Function since it doesn't need a persistent
// process, but *this* half calls agentRunner.startTask directly and has to
// stay in the same process as AgentRunner (the real file/git work can't be
// serverless — PRD §5.1). This worker is now the only thing that starts
// employee task runs; Nova's scheduled function no longer touches AgentRunner
// at all, so both sides only ever coordinate through the Postgres tasks
// table, never in-process.
function isReady(task: Task, tasksById: Map<string, Task>): boolean {
  if (task.status !== 'idle') return false;
  return task.depends_on.every((depId) => tasksById.get(depId)?.status === 'done');
}

export async function dispatchReadyTasks(): Promise<void> {
  const tasks = await hive.listTasks();
  const tasksById = new Map(tasks.map((t) => [t.id, t]));

  for (const task of tasks) {
    if (agentRunner.atCapacity()) break; // hard cap (env.MAX_CONCURRENT_SESSIONS) — remaining ready tasks wait for a slot
    if (!isReady(task, tasksById)) continue;
    if (agentRunner.isBusy(task.agent_id)) continue;

    const agent = ROSTER.find((a) => a.id === task.agent_id);
    if (!agent) {
      console.error(`[dispatch] task ${task.id} references unknown agent id "${task.agent_id}"`);
      continue;
    }
    try {
      agentRunner.startTask(agent, task);
    } catch (err) {
      console.error(`[dispatch] failed to start task ${task.id} for ${task.agent_id}`, err);
    }
  }
}

let loopHandle: ReturnType<typeof setInterval> | null = null;

export function startDispatchLoop(): void {
  if (loopHandle) return;
  loopHandle = setInterval(() => {
    void dispatchReadyTasks().catch((err) => console.error('[dispatch] poll failed', err));
  }, env.DISPATCH_POLL_INTERVAL_MS);
}

export function stopDispatchLoop(): void {
  if (loopHandle) clearInterval(loopHandle);
  loopHandle = null;
}
