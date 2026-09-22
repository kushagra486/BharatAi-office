import type { BriefRecord, Task } from '@bharat-ai-office/shared';

export interface WorkingProjectsPanelProps {
  brief: BriefRecord | null;
  tasks: Task[];
}

const STATUS_LABEL: Record<string, string> = {
  planning: 'Planning',
  in_progress: 'In progress',
  complete: 'Complete',
};

/**
 * The Hive only ever tracks one active brief at a time (§5.4) — "working
 * projects" is that single current project, shown as a card, rather than a
 * fabricated list the data model doesn't actually support.
 */
export function WorkingProjectsPanel({ brief, tasks }: WorkingProjectsPanelProps) {
  if (!brief) {
    return (
      <div className="rounded-xl border border-line bg-panel p-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-[#6B7686]">Working projects</p>
        <p className="mt-2 text-sm text-[#6B7686]">No project in flight. Submit a brief from the Office page to start one.</p>
      </div>
    );
  }

  const done = tasks.filter((t) => t.status === 'done').length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-wide text-[#6B7686]">Working projects</p>
      <p className="mt-2 line-clamp-2 text-sm text-[#E6EDF3]">{brief.brief}</p>
      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[#8B96A5]">
        <span className="rounded border border-line px-2 py-0.5 uppercase tracking-wide text-violet">
          {STATUS_LABEL[brief.status] ?? brief.status}
        </span>
        <span>
          {done}/{total} tasks{brief.etaMinutes != null ? ` · ETA ~${brief.etaMinutes}m` : ''}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-cyan transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
