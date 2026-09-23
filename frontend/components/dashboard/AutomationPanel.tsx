'use client';

import { useState } from 'react';
import type { ActivityFeedEntry, Agent, Task } from '@bharat-ai-office/shared';
import { formatRelativeTime } from '@/lib/format';
import { getTaskDiff } from '@/lib/daemonApi';

export interface AutomationPanelProps {
  agents: Agent[];
  tasks: Task[];
  activityFeed: ActivityFeedEntry[];
}

const KIND_COLOR: Record<ActivityFeedEntry['kind'], string> = {
  output: 'text-[#8B96A5]',
  done: 'text-green',
  failed: 'text-magenta',
};

function agentName(agents: Agent[], agentId: string): string {
  return agents.find((a) => a.id === agentId)?.name ?? agentId;
}

function FeedRow({ entry, agents }: { entry: ActivityFeedEntry; agents: Agent[] }) {
  // Tool-call output chunks can be long (file contents, multi-line results)
  // — this is a scannable live feed, not a terminal, so truncate hard; the
  // employee side panel's per-agent terminal is still the place for the
  // full unclipped text.
  const preview = entry.text.length > 160 ? `${entry.text.slice(0, 160)}…` : entry.text;
  // Non-fatal router warnings (e.g. latency tracking failing, which just
  // means the picker falls back to headroom-only ranking) are emitted as
  // plain 'output' chunks — there's no dedicated broadcast kind for them —
  // so detect the ⚠ prefix router.ts's onWarning callback always sends and
  // color it distinctly instead of blending into normal tool-call output.
  const isWarning = entry.kind === 'output' && entry.text.startsWith('⚠');
  const colorClass = isWarning ? 'text-amber' : KIND_COLOR[entry.kind];
  return (
    <li className={`flex items-start gap-2 border-b py-1.5 font-mono text-[11px] last:border-b-0 ${isWarning ? 'border-amber/30 bg-amber/5' : 'border-line/60'}`}>
      <span className="shrink-0 text-[#6B7686]">{formatRelativeTime(entry.at)}</span>
      <span className="shrink-0 font-semibold text-[#C7D0DA]">{agentName(agents, entry.agentId)}</span>
      <span className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${colorClass}`}>{preview}</span>
    </li>
  );
}

function DiffViewer({ diff }: { diff: string }) {
  return (
    <pre className="mt-2 max-h-64 overflow-auto rounded border border-line bg-void p-2 font-mono text-[10px] leading-relaxed">
      {diff.split('\n').map((line, i) => {
        const color = line.startsWith('+') && !line.startsWith('+++') ? 'text-green' : line.startsWith('-') && !line.startsWith('---') ? 'text-magenta' : 'text-[#8B96A5]';
        return (
          <div key={i} className={color}>
            {line || ' '}
          </div>
        );
      })}
    </pre>
  );
}

function CompletedTaskRow({ task, agents }: { task: Task; agents: Agent[] }) {
  const [expanded, setExpanded] = useState(false);
  const [diff, setDiff] = useState<string | null | undefined>(undefined); // undefined = not yet fetched, null = fetched but none exists
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (diff === undefined) {
      setLoading(true);
      try {
        setDiff(await getTaskDiff(task.id));
      } catch (err) {
        console.error('failed to fetch diff for', task.id, err);
        setDiff(null);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <li className="border-b border-line/60 py-2 last:border-b-0">
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[12px] text-[#C7D0DA]">{task.title}</span>
          <span className="font-mono text-[10px] text-[#6B7686]">
            {agentName(agents, task.agent_id)} · {formatRelativeTime(task.updated_at)}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-cyan">{expanded ? 'Hide diff' : 'View diff'}</span>
      </button>
      {expanded && (
        <>
          {loading && <p className="mt-2 font-mono text-[10px] text-[#6B7686]">loading…</p>}
          {!loading && diff && <DiffViewer diff={diff} />}
          {!loading && !diff && <p className="mt-2 font-mono text-[10px] text-[#6B7686]">No diff recorded for this task.</p>}
        </>
      )}
    </li>
  );
}

/**
 * Automation / Delivery panel: a live chronological feed of every agent's
 * tool calls (not just the currently-selected one — see the employee side
 * panel for that), plus a diff preview for each completed task so a human
 * can see exactly what changed without downloading every file.
 */
export function AutomationPanel({ agents, tasks, activityFeed }: AutomationPanelProps) {
  const recentlyDone = tasks
    .filter((t) => t.status === 'done')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-panel p-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-[#6B7686]">Live activity</p>
        {activityFeed.length === 0 ? (
          <p className="mt-2 text-sm text-[#6B7686]">No activity yet — this fills in as agents make tool calls.</p>
        ) : (
          <ul className="mt-2 max-h-72 overflow-y-auto">
            {activityFeed.map((entry) => (
              <FeedRow key={entry.id} entry={entry} agents={agents} />
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-line bg-panel p-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-[#6B7686]">Recent deliveries</p>
        {recentlyDone.length === 0 ? (
          <p className="mt-2 text-sm text-[#6B7686]">No completed tasks yet.</p>
        ) : (
          <ul className="mt-2 max-h-72 overflow-y-auto">
            {recentlyDone.map((task) => (
              <CompletedTaskRow key={task.id} task={task} agents={agents} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
