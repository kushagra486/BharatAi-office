import type { Agent, HiveMessage, Task } from '@bharat-ai-office/shared';

export interface EmployeeSidePanelProps {
  agent: Agent | null;
  tasks: Task[];
  messages: HiveMessage[];
  terminalBuffer: string;
  onClose: () => void;
}

export function EmployeeSidePanel({ agent, tasks, messages, terminalBuffer, onClose }: EmployeeSidePanelProps) {
  const open = agent !== null;
  const agentTasks = agent ? tasks.filter((t) => t.agent_id === agent.id) : [];
  const currentTask = agentTasks.find((t) => t.status === 'working') ?? agentTasks[agentTasks.length - 1];
  const activity = agent ? messages.filter((m) => m.from_agent === agent.id || m.to_agent === agent.id).slice(0, 30) : [];

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
            <div>
              <h2 className="font-mono text-sm uppercase tracking-wide text-[#E6EDF3]">{agent.name}</h2>
              <p className="font-mono text-[11px] text-[#6B7686]">{agent.role}</p>
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

          <div className="flex-1 overflow-y-auto border-b border-line p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-cyan">Live terminal</p>
            {/* Chunks arrive incrementally over the socket as claude -p streams,
                so simply appending them already reads as a typewriter feed. */}
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
