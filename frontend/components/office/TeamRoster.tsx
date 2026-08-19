import type { Agent, Task } from '@bharat-ai-office/shared';
import { STATUS_COLOR } from '@bharat-ai-office/shared';
import { agentStatus, currentTaskFor, tasksByAgentMap } from '@/lib/agentStatus';

export interface TeamRosterProps {
  agents: Agent[];
  tasks: Task[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  working: 'Working',
  blocked: 'Blocked',
  done: 'Done',
  idle: 'Idle',
};

export function TeamRoster({ agents, tasks, selectedAgentId, onSelectAgent }: TeamRosterProps) {
  const tasksByAgent = tasksByAgentMap(tasks);
  const withStatus = agents.map((agent) => ({
    agent,
    status: agent.id === 'nova' ? 'idle' : agentStatus(agent.id, tasksByAgent),
    task: currentTaskFor(agent.id, tasksByAgent),
  }));
  const workingCount = withStatus.filter((a) => a.status === 'working').length;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-l border-line bg-panel lg:flex">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#6B7686]">Team ({agents.length})</span>
        {workingCount > 0 && (
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse-dot" />
            {workingCount} working
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {withStatus.map(({ agent, status, task }) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => onSelectAgent(agent.id)}
            className={`flex w-full items-start gap-2.5 border-b border-line/60 px-3 py-2.5 text-left transition-colors hover:bg-line/20 ${
              selectedAgentId === agent.id ? 'bg-line/30' : ''
            }`}
          >
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[status], boxShadow: status === 'working' || status === 'blocked' ? `0 0 6px ${STATUS_COLOR[status]}` : undefined }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate font-mono text-xs font-semibold text-[#E6EDF3]">{agent.name}</span>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-[#6B7686]">
                  {STATUS_LABEL[status]}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-[#8B96A5]">{task ? task.title : agent.role}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
