import type { Agent } from '@bharat-ai-office/shared';
import { jobDescriptionFor } from '@/lib/agentWork';
import { AgentAvatar } from '@/components/office/AgentAvatar';

export interface AgentRosterGridProps {
  agents: Agent[];
}

/** Name, photo, title, and job charter for every agent — the "who works here" roster. */
export function AgentRosterGrid({ agents }: AgentRosterGridProps) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-wide text-[#6B7686]">Working agents</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-start gap-3 rounded-lg border border-line/60 p-3">
            <AgentAvatar agent={agent} status="idle" size={40} />
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-semibold text-[#E6EDF3]">{agent.name}</p>
              <p className="truncate text-xs text-[#8B96A5]">{agent.role}</p>
              <p className="mt-1 text-[11px] leading-snug text-[#6B7686]">{jobDescriptionFor(agent.id)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
