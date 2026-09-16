import type { Agent, Task } from '@bharat-ai-office/shared';
import { workCountsByAgent } from '@/lib/agentWork';
import { agentColorHex } from '@/lib/agentColor';

export interface AgentsWorkGraphProps {
  agents: Agent[];
  tasks: Task[];
}

/**
 * Horizontal bar chart of completed tasks per employee. Bars carry each
 * agent's own identity color (already used app-wide for that agent), but
 * every row is always directly labeled with the agent's name — per the
 * dataviz skill's rule that identity must never rest on color alone, this
 * matters here specifically because the existing 11-color agent palette
 * doesn't clear the colorblind-safe adjacent-pair check on its own.
 */
export function AgentsWorkGraph({ agents, tasks }: AgentsWorkGraphProps) {
  const counts = workCountsByAgent(
    agents.filter((a) => a.id !== 'nova'),
    tasks
  ).sort((a, b) => b.done - a.done);
  const max = Math.max(...counts.map((c) => c.done), 1);
  const anyWork = counts.some((c) => c.done > 0);

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-wide text-[#6B7686]">Agents work graph — tasks completed</p>
      {!anyWork ? (
        <p className="mt-3 text-sm text-[#6B7686]">No completed tasks yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {counts.map(({ agent, done }) => (
            <li key={agent.id} className="flex items-center gap-2" title={`${agent.name}: ${done} completed`}>
              <span className="w-16 shrink-0 truncate font-mono text-[11px] text-[#C7D0DA]">{agent.name}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full transition-all duration-500"
                  style={{ width: `${(done / max) * 100}%`, backgroundColor: agentColorHex(agent.color) }}
                />
              </span>
              <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-[#8B96A5]">{done}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
