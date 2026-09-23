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
    <div className="rounded-2xl border border-amber/40 bg-surface p-4 shadow-elevated">
      <p className="text-[13px] font-semibold text-amber">★ Best worker</p>
      {!top ? (
        <p className="mt-3 text-sm text-ink-faint">No completed tasks yet — the leaderboard fills in as work ships.</p>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <AgentAvatar agent={top.agent} status="done" size={48} />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold text-ink">{top.agent.name}</p>
            <p className="truncate text-xs text-ink-muted">{top.agent.role}</p>
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              {top.done} task{top.done === 1 ? '' : 's'} done · {formatTokenCount(usage[top.agent.id]?.approxTokens ?? 0)} tokens
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
