import type { Agent, BriefRecord, HiveMessage, LlmUsageByAgent, Task } from '@bharat-ai-office/shared';
import { useClock } from '@/hooks/useClock';
import { formatRelativeTime } from '@/lib/format';
import { bestWorker } from '@/lib/agentWork';

export interface MeetingSummaryBoardProps {
  agents: Agent[];
  tasks: Task[];
  messages: HiveMessage[];
  usage: LlmUsageByAgent;
  brief: BriefRecord | null;
}

/**
 * A standup-board summary computed from what the agents' own work has
 * actually produced (tasks, reports) — not a fresh LLM call, since a stale
 * few-seconds-old aggregate of real hive state is more useful here than an
 * extra round-trip that fails identically to every other call when no
 * provider key is configured.
 */
export function MeetingSummaryBoard({ agents, tasks, messages, usage, brief }: MeetingSummaryBoardProps) {
  const now = useClock();
  const done = tasks.filter((t) => t.status === 'done').length;
  const working = tasks.filter((t) => t.status === 'working').length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  const lastReport = messages.find((m) => m.type === 'report');
  const top = bestWorker(agents, tasks, usage);

  const hasAnyActivity = tasks.length > 0 || messages.length > 0;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-elevated">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-violet">Office board — meeting summary</p>
        <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-ink-faint">
          {now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
        </span>
      </div>

      {!hasAnyActivity ? (
        <p className="mt-3 text-sm text-ink-muted">
          No brief submitted yet — give the office something to build on the Office page to see a live summary here.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
          <li>
            <span className="text-green">{done} done</span>, <span className="text-cyan">{working} working</span>,{' '}
            <span className="text-magenta">{blocked} blocked</span> across {agents.length} agents.
          </li>
          {brief && (
            <li className="truncate">
              Current focus: <span className="text-ink">{brief.brief}</span>{' '}
              <span className="text-ink-faint">
                ({brief.status}
                {brief.etaMinutes != null ? `, ETA ~${brief.etaMinutes}m` : ''})
              </span>
            </li>
          )}
          {top && (
            <li>
              <span className="text-amber">{top.agent.name}</span> leads with {top.done} completed task{top.done === 1 ? '' : 's'}.
            </li>
          )}
          {lastReport && (
            <li className="truncate text-ink-muted">
              Latest report from <span className="text-ink-muted">{lastReport.from_agent}</span>: “{lastReport.body}” (
              {formatRelativeTime(lastReport.created_at)})
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
