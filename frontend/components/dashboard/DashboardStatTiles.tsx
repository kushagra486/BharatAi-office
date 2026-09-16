import type { Agent, LlmUsageByAgent, Task } from '@bharat-ai-office/shared';
import { formatTokenCount } from '@/lib/format';

export interface DashboardStatTilesProps {
  agents: Agent[];
  tasks: Task[];
  usage: LlmUsageByAgent;
}

// Stat tile contract (dataviz skill): sentence-case label, no trailing colon,
// Sans semibold auto-compact value — proportional figures at this size, not
// tabular-nums (that's reserved for columns of aligned numbers).
function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-wide text-[#6B7686]">{label}</p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

export function DashboardStatTiles({ agents, tasks, usage }: DashboardStatTilesProps) {
  const values = Object.values(usage);
  const totalTokens = values.reduce((sum, u) => sum + u.approxTokens, 0);
  const totalCalls = values.reduce((sum, u) => sum + u.calls, 0);
  const workingNow = tasks.filter((t) => t.status === 'working').length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Available agents" value={String(agents.length)} accent="#E6EDF3" />
      <StatTile label="Working now" value={String(workingNow)} accent="#2FE6D2" />
      <StatTile label="Tokens used" value={formatTokenCount(totalTokens)} accent="#8B7CF6" />
      <StatTile label="LLM calls" value={String(totalCalls)} accent="#FFB454" />
    </div>
  );
}
