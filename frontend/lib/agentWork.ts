import type { Agent, HiveMessage, LlmUsageByAgent, Task } from '@bharat-ai-office/shared';
import { ROLE_SCOPE } from '@bharat-ai-office/shared';

const NOVA_SCOPE = 'Always-on orchestrator — decomposes briefs into a task graph, assigns work by role fit, and triages escalations.';

/** ROLE_SCOPE only covers the 10 employees (PRD §8.1) — Nova gets her own description here rather than a missing-entry fallback string. */
export function jobDescriptionFor(agentId: string): string {
  return ROLE_SCOPE[agentId] ?? NOVA_SCOPE;
}

export interface WorkCount {
  agent: Agent;
  done: number;
  working: number;
  blocked: number;
}

/** Per-agent completed/active/blocked task counts, in roster order — the "agents work graph" data. */
export function workCountsByAgent(agents: Agent[], tasks: Task[]): WorkCount[] {
  return agents.map((agent) => {
    const own = tasks.filter((t) => t.agent_id === agent.id);
    return {
      agent,
      done: own.filter((t) => t.status === 'done').length,
      working: own.filter((t) => t.status === 'working').length,
      blocked: own.filter((t) => t.status === 'blocked').length,
    };
  });
}

/** The agent with the most completed tasks, tied broken by tokens used — null until anyone has finished anything. */
export function bestWorker(agents: Agent[], tasks: Task[], usage: LlmUsageByAgent): WorkCount | null {
  const counts = workCountsByAgent(agents, tasks).filter((c) => c.agent.id !== 'nova');
  const withWork = counts.filter((c) => c.done > 0);
  if (withWork.length === 0) return null;
  return withWork.sort((a, b) => b.done - a.done || (usage[b.agent.id]?.approxTokens ?? 0) - (usage[a.agent.id]?.approxTokens ?? 0))[0];
}

export interface MeshEdge {
  from: string;
  to: string;
  count: number;
}

/** Aggregates the message log into undirected from<->to edge weights, for the agent mesh graph. */
export function messageEdgeCounts(messages: HiveMessage[]): MeshEdge[] {
  const counts = new Map<string, MeshEdge>();
  for (const m of messages) {
    if (m.from_agent === m.to_agent) continue;
    const key = [m.from_agent, m.to_agent].sort().join('::');
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      const [from, to] = key.split('::');
      counts.set(key, { from, to, count: 1 });
    }
  }
  return [...counts.values()];
}
