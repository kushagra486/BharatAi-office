import type { Agent, HiveMessage, LlmUsageStats, Task } from '@bharat-ai-office/shared';
import { agentStatus, tasksByAgentMap } from '@/lib/agentStatus';
import { formatRelativeTime, formatTokenCount } from '@/lib/format';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { isTyping, useTypewriter } from '@/hooks/useTypewriter';
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
      <p className="text-[11px] font-semibold uppercase tracking-wide text-green">LLM usage</p>
      {!usage ? (
        <p className="mt-1 text-xs text-ink-muted">No calls made yet.</p>
      ) : (
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px] text-ink-muted">
          <span className="text-ink-faint">Provider</span>
          <span className="text-right">{usage.provider}</span>
          <span className="text-ink-faint">Model</span>
          <span className="truncate text-right" title={usage.model}>
            {usage.model}
          </span>
          <span className="text-ink-faint">Calls</span>
          <span className="text-right tabular-nums">{usage.calls}</span>
          <span className="text-ink-faint">Tokens</span>
          <span className="text-right tabular-nums">⚡{formatTokenCount(tokens)}</span>
          <span className="text-ink-faint">Last call</span>
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
  const typedTerminal = useTypewriter(terminalBuffer);

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
                <h2 className="text-[15px] font-semibold text-ink">{agent.name}</h2>
                <p className="text-[12px] text-ink-faint">{agent.role}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close employee panel"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-line/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40"
            >
              ✕
            </button>
          </div>

          <div className="border-b border-line p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet">Current task</p>
            <p className="mt-1 text-sm text-ink">{currentTask ? currentTask.title : 'Idle — no task assigned'}</p>
            {currentTask && <p className="mt-1 text-xs text-ink-muted">{currentTask.description}</p>}
          </div>

          <UsageBlock usage={usage} />

          <div className="flex-1 overflow-y-auto border-b border-line p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cyan">Live terminal</p>
            {/* Chunks arrive incrementally over the socket as the agent's tool-use
                loop completes each turn (model reasoning, then tool calls/results);
                useTypewriter reveals the accumulated buffer progressively rather
                than swapping it in all at once, so it reads as a live feed. */}
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-void p-3 font-mono text-[11px] leading-relaxed text-[#8FE9DC]">
              {typedTerminal || '(no output yet)'}
              {isTyping(typedTerminal, terminalBuffer) && <span className="animate-cursor-blink text-cyan">▌</span>}
            </pre>
          </div>

          <div className="max-h-56 overflow-y-auto p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber">Activity log</p>
            <ul className="space-y-2">
              {activity.length === 0 && <li className="text-[11px] text-ink-faint">No activity yet.</li>}
              {activity.map((m) => (
                <li key={m.id} className="font-mono text-[11px] text-ink-muted">
                  <span className="text-ink-faint">{new Date(m.created_at).toLocaleTimeString()}</span>{' '}
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
