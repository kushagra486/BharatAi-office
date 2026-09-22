import type { Agent, LlmUsageByAgent } from '@bharat-ai-office/shared';
import { jobDescriptionFor } from '@/lib/agentWork';
import { formatTokenCount } from '@/lib/format';
import { AgentAvatar } from '@/components/office/AgentAvatar';

export interface AgentRosterGridProps {
  agents: Agent[];
  usage: LlmUsageByAgent;
}

/** Name, photo, title, job charter, and live provider/model + token usage for every agent — the "who works here" roster. */
export function AgentRosterGrid({ agents, usage }: AgentRosterGridProps) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-wide text-[#6B7686]">Working agents</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => {
          const agentUsage = usage[agent.id];
          return (
            <div key={agent.id} className="flex items-start gap-3 rounded-lg border border-line/60 p-3">
              <AgentAvatar agent={agent} status="idle" size={40} />
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold text-[#E6EDF3]">{agent.name}</p>
                <p className="truncate text-xs text-[#8B96A5]">{agent.role}</p>
                <p className="mt-1 text-[11px] leading-snug text-[#6B7686]">{jobDescriptionFor(agent.id)}</p>
                {agentUsage && (
                  <p
                    className="mt-1 truncate font-mono text-[10px] lowercase text-[#6B7686]"
                    title={`${agentUsage.approxTokens.toLocaleString()} tokens · ${agentUsage.calls} calls`}
                  >
                    {agentUsage.provider}/{agentUsage.model} · ⚡{formatTokenCount(agentUsage.approxTokens)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
