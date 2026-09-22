import type { Agent, LlmUsageByAgent, Task } from '@bharat-ai-office/shared';
import { bestWorker } from '@/lib/agentWork';
import { formatTokenCount } from '@/lib/format';
import { AgentAvatar } from '@/components/office/AgentAvatar';

export interface BestWorkerCardProps {
  agents: Agent[];
  tasks: Task[];
  usage: LlmUsageByAgent;
}

export function BestWorkerCard({ agents, tasks, usage }: BestWorkerCardProps) {
  const top = bestWorker(agents, tasks, usage);

  return (
    <div className="rounded-xl border border-amber/40 bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-wide text-amber">★ Best worker</p>
      {!top ? (
        <p className="mt-3 text-sm text-[#6B7686]">No completed tasks yet — the leaderboard fills in as work ships.</p>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <AgentAvatar agent={top.agent} status="done" size={48} />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold text-[#E6EDF3]">{top.agent.name}</p>
            <p className="truncate text-xs text-[#8B96A5]">{top.agent.role}</p>
            <p className="mt-1 font-mono text-[11px] text-[#6B7686]">
              {top.done} task{top.done === 1 ? '' : 's'} done · {formatTokenCount(usage[top.agent.id]?.approxTokens ?? 0)} tokens
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
