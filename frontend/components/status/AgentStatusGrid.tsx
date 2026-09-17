import type { Agent, Escalation, LlmUsageByAgent, Task } from '@bharat-ai-office/shared';
import { STATUS_COLOR } from '@bharat-ai-office/shared';
import { agentStatus, currentTaskFor, tasksByAgentMap } from '@/lib/agentStatus';
import { jobDescriptionFor } from '@/lib/agentWork';
import { formatTokenCount } from '@/lib/format';
import { AgentAvatar } from '@/components/office/AgentAvatar';

export interface AgentStatusGridProps {
  agents: Agent[];
  tasks: Task[];
  escalations: Escalation[];
  usage: LlmUsageByAgent;
}

const STATUS_LABEL: Record<string, string> = { working: 'Working', blocked: 'Blocked', done: 'Done', idle: 'Idle' };

function latestBlockedReasonFor(agentId: string, escalations: Escalation[]): string | undefined {
  return escalations.find((e) => e.agent_id === agentId && e.resolution === 'pending')?.description;
}

export function AgentStatusGrid({ agents, tasks, escalations, usage }: AgentStatusGridProps) {
  const tasksByAgent = tasksByAgentMap(tasks);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => {
        const isNova = agent.id === 'nova';
        const status = isNova ? 'idle' : agentStatus(agent.id, tasksByAgent);
        const task = isNova ? undefined : currentTaskFor(agent.id, tasksByAgent);
        const blockedReason = status === 'blocked' ? latestBlockedReasonFor(agent.id, escalations) : undefined;
        const agentUsage = usage[agent.id];

        return (
          <div key={agent.id} className="rounded-xl border border-line bg-panel p-4">
            <div className="flex items-center gap-3">
              <AgentAvatar agent={agent} status={status} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-mono text-sm font-semibold text-[#E6EDF3]">{agent.name}</p>
                  <span
                    className="shrink-0 font-mono text-[10px] uppercase tracking-wide"
                    style={{ color: STATUS_COLOR[status] }}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <p className="truncate text-xs text-[#8B96A5]">{agent.role}</p>
                {agentUsage && (
                  <p
                    className="mt-0.5 truncate font-mono text-[10px] lowercase text-[#6B7686]"
                    title={`${agentUsage.approxTokens.toLocaleString()} tokens · ${agentUsage.calls} calls`}
                  >
                    {agentUsage.provider}/{agentUsage.model} · ⚡{formatTokenCount(agentUsage.approxTokens)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 border-t border-line/60 pt-3">
              {isNova ? (
                <p className="text-[12px] leading-snug text-[#8B96A5]">{jobDescriptionFor('nova')}</p>
              ) : task ? (
                <>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-violet">Current task</p>
                  <p className="mt-0.5 truncate text-[12px] text-[#C7D0DA]">{task.title}</p>
                  {blockedReason && <p className="mt-1 text-[11px] text-magenta">Blocked: {blockedReason}</p>}
                </>
              ) : (
                <>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-amber">Job suggestion</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-[#8B96A5]">
                    No active task — typically works on: {jobDescriptionFor(agent.id)}
                  </p>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
