import type { Agent, LlmUsageByAgent, Task } from '@bharat-ai-office/shared';
import { agentStatus, currentTaskFor, tasksByAgentMap } from '@/lib/agentStatus';
import { jobDescriptionFor } from '@/lib/agentWork';
import { formatTokenCount } from '@/lib/format';
import { providerColorHex } from '@/lib/providerColor';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { useTokenHistory } from '@/hooks/useTokenHistory';
import { AgentAvatar } from './AgentAvatar';
import { TokenSparkline } from './TokenSparkline';

export interface TeamRosterProps {
  agents: Agent[];
  tasks: Task[];
  usage: LlmUsageByAgent;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  working: 'Working',
  blocked: 'Blocked',
  done: 'Done',
  idle: 'Idle',
};

function TokenBadge({ tokens }: { tokens: number }) {
  const animated = useAnimatedNumber(tokens);
  if (tokens === 0) return null;
  return (
    <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#6B7686]" title={`${tokens.toLocaleString()} tokens`}>
      ⚡{formatTokenCount(animated)}
    </span>
  );
}

/** Short "provider/model" tag — the model name alone is often long, so this truncates hard and relies on the title tooltip for the full slug. */
function ModelTag({ provider, model }: { provider: string; model: string }) {
  return (
    <span
      className="max-w-[110px] shrink truncate font-mono text-[9px] lowercase tracking-tight text-[#6B7686]"
      title={`${provider} · ${model}`}
    >
      {provider}/{model}
    </span>
  );
}

export function TeamRoster({ agents, tasks, usage, selectedAgentId, onSelectAgent }: TeamRosterProps) {
  const tasksByAgent = tasksByAgentMap(tasks);
  const withStatus = agents.map((agent) => ({
    agent,
    status: agent.id === 'nova' ? 'idle' : agentStatus(agent.id, tasksByAgent),
    task: currentTaskFor(agent.id, tasksByAgent),
  }));
  const workingCount = withStatus.filter((a) => a.status === 'working').length;

  const totalTokens = Object.values(usage).reduce((sum, u) => sum + u.approxTokens, 0);
  const totalCalls = Object.values(usage).reduce((sum, u) => sum + u.calls, 0);
  const byProvider = Object.values(usage).reduce<Record<string, number>>((acc, u) => {
    acc[u.provider] = (acc[u.provider] ?? 0) + u.approxTokens;
    return acc;
  }, {});
  const animatedTotalTokens = useAnimatedNumber(totalTokens);
  const tokenHistory = useTokenHistory(totalTokens);

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-line bg-panel lg:w-64 lg:border-l lg:border-t-0">
      <div className="border-b border-line px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#6B7686]">Team ({agents.length})</span>
          {workingCount > 0 && (
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-cyan">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse-dot" />
              {workingCount} working
            </span>
          )}
        </div>
        {totalCalls > 0 && (
          <>
            <div className="mt-1.5 font-mono text-[10px] tabular-nums text-[#6B7686]">
              ⚡ {formatTokenCount(animatedTotalTokens)} tokens · {totalCalls} calls
            </div>
            {/* Visible provider/source breakdown — this used to be a hover-only tooltip on the line above, easy to miss entirely. */}
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {Object.entries(byProvider)
                .sort((a, b) => b[1] - a[1])
                .map(([provider, tokens]) => (
                  <span
                    key={provider}
                    className="flex items-center gap-1 font-mono text-[9px] lowercase tabular-nums text-[#6B7686]"
                    title={`${provider}: ${tokens.toLocaleString()} tokens`}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: providerColorHex(provider) }} />
                    {provider} {formatTokenCount(tokens)}
                  </span>
                ))}
            </div>
            <div className="mt-1.5">
              <TokenSparkline data={tokenHistory} />
            </div>
          </>
        )}
      </div>
      {/* No forced scroll region below `lg` — on mobile this panel sits in the page's normal flow below the office floor, and a nested scrollbar fighting the page scroll is worse there. The fixed-height sidebar + its own scrollbar is desktop-only. */}
      <div className="lg:flex-1 lg:overflow-y-auto">
        {withStatus.map(({ agent, status, task }, index) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => onSelectAgent(agent.id)}
            style={{ animationDelay: `${index * 35}ms` }}
            className={`flex w-full origin-left animate-fade-slide-up items-start gap-2.5 border-b border-line/60 px-3 py-2.5 text-left transition-all duration-150 hover:scale-[1.015] hover:bg-line/20 active:scale-[0.99] ${
              selectedAgentId === agent.id ? 'bg-line/30' : ''
            }`}
          >
            <AgentAvatar agent={agent} status={status} size={30} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate font-mono text-xs font-semibold text-[#E6EDF3]">{agent.name}</span>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-[#6B7686]">
                  {STATUS_LABEL[status]}
                </span>
              </span>
              <span className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px] text-[#8B96A5]">{task ? task.title : agent.role}</span>
                <TokenBadge tokens={usage[agent.id]?.approxTokens ?? 0} />
              </span>
              {!task && agent.id !== 'nova' && (
                <span className="mt-0.5 block truncate text-[10px] italic text-[#6B7686]" title={jobDescriptionFor(agent.id)}>
                  Suggestion: {jobDescriptionFor(agent.id)}
                </span>
              )}
              {usage[agent.id] && (
                <span className="mt-0.5 flex items-baseline justify-end">
                  <ModelTag provider={usage[agent.id].provider} model={usage[agent.id].model} />
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
