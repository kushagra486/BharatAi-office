import type { Agent, HiveMessage, LlmUsageStats, Task } from '@bharat-ai-office/shared';
import { agentStatus, tasksByAgentMap } from '@/lib/agentStatus';
import { formatRelativeTime, formatTokenCount } from '@/lib/format';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { AgentAvatar } from './AgentAvatar';

export interface EmployeeSidePanelProps {
  agent: Agent | null;
  tasks: Task[];
  messages: HiveMessage[];
  terminalBuffer: string;
  usage: LlmUsageStats | undefined;
  onClose: () => void;
}

function UsageBlock({ usage }: { usage: LlmUsageStats | undefined }) {
  const tokens = useAnimatedNumber(usage?.approxTokens ?? 0);
  return (
    <div className="border-b border-line p-4">
      <p className="font-mono text-[10px] uppercase tracking-wide text-green">LLM usage</p>
      {!usage ? (
        <p className="mt-1 text-xs text-[#8B96A5]">No calls made yet.</p>
      ) : (
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-[#C7D0DA]">
          <span className="text-[#6B7686]">Provider</span>
          <span className="text-right">{usage.provider}</span>
          <span className="text-[#6B7686]">Model</span>
          <span className="truncate text-right" title={usage.model}>
            {usage.model}
          </span>
          <span className="text-[#6B7686]">Calls</span>
          <span className="text-right tabular-nums">{usage.calls}</span>
          <span className="text-[#6B7686]">Tokens</span>
          <span className="text-right tabular-nums">⚡{formatTokenCount(tokens)}</span>
          <span className="text-[#6B7686]">Last call</span>
          <span className="text-right">{formatRelativeTime(usage.lastCallAt)}</span>
        </div>
      )}
    </div>
  );
}

export function EmployeeSidePanel({ agent, tasks, messages, terminalBuffer, usage, onClose }: EmployeeSidePanelProps) {
  const open = agent !== null;
  const agentTasks = agent ? tasks.filter((t) => t.agent_id === agent.id) : [];
  const currentTask = agentTasks.find((t) => t.status === 'working') ?? agentTasks[agentTasks.length - 1];
  const activity = agent ? messages.filter((m) => m.from_agent === agent.id || m.to_agent === agent.id).slice(0, 30) : [];
  const status = agent ? (agent.id === 'nova' ? 'idle' : agentStatus(agent.id, tasksByAgentMap(tasks))) : 'idle';

  return (
    <div
      className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-md transform flex-col border-l border-line bg-panel shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!open}
    >
      {agent && (
        <>
          <div className="flex items-center justify-between border-b border-line p-4">
            <div className="flex items-center gap-3">
              <AgentAvatar agent={agent} status={status} size={44} />
              <div>
                <h2 className="font-mono text-sm uppercase tracking-wide text-[#E6EDF3]">{agent.name}</h2>
                <p className="font-mono text-[11px] text-[#6B7686]">{agent.role}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="font-mono text-xs text-[#6B7686] hover:text-cyan">
              ✕
            </button>
          </div>

          <div className="border-b border-line p-4">
            <p className="font-mono text-[10px] uppercase tracking-wide text-violet">Current task</p>
            <p className="mt-1 text-sm text-[#E6EDF3]">{currentTask ? currentTask.title : 'Idle — no task assigned'}</p>
            {currentTask && <p className="mt-1 text-xs text-[#8B96A5]">{currentTask.description}</p>}
          </div>

          <UsageBlock usage={usage} />

          <div className="flex-1 overflow-y-auto border-b border-line p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-cyan">Live terminal</p>
            {/* Chunks arrive incrementally over the socket as the agent's tool-use
                loop completes each turn (model reasoning, then tool calls/results),
                so simply appending them reads as a live step-by-step log. */}
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-void p-3 font-mono text-[11px] leading-relaxed text-[#8FE9DC]">
              {terminalBuffer || '(no output yet)'}
            </pre>
          </div>

          <div className="max-h-56 overflow-y-auto p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-amber">Activity log</p>
            <ul className="space-y-2">
              {activity.length === 0 && <li className="font-mono text-[11px] text-[#6B7686]">No activity yet.</li>}
              {activity.map((m) => (
                <li key={m.id} className="font-mono text-[11px] text-[#8B96A5]">
                  <span className="text-[#6B7686]">{new Date(m.created_at).toLocaleTimeString()}</span>{' '}
                  <span className="text-violet">
                    {m.from_agent}→{m.to_agent}
                  </span>{' '}
                  {m.body}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
