import type { Task, TaskStatus } from '@bharat-ai-office/shared';

export function tasksByAgentMap(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    const list = map.get(task.agent_id) ?? [];
    list.push(task);
    map.set(task.agent_id, list);
  }
  return map;
}

export function agentStatus(agentId: string, tasksByAgent: Map<string, Task[]>): TaskStatus {
  const list = tasksByAgent.get(agentId) ?? [];
  if (list.some((t) => t.status === 'blocked')) return 'blocked';
  if (list.some((t) => t.status === 'working')) return 'working';
  if (list.length > 0 && list.every((t) => t.status === 'done')) return 'done';
  return 'idle';
}

export function currentTaskFor(agentId: string, tasksByAgent: Map<string, Task[]>): Task | undefined {
  const list = tasksByAgent.get(agentId) ?? [];
  return list.find((t) => t.status === 'working') ?? list.find((t) => t.status === 'blocked') ?? list[list.length - 1];
}
