import type { ModelUsageStats } from '@bharat-ai-office/shared';
import { formatTokenCount, formatRelativeTime } from '@/lib/format';
import { providerColorHex } from '@/lib/providerColor';

export interface ModelUsagePanelProps {
  usage: ModelUsageStats[];
}

interface ModelRow {
  provider: string;
  model: string;
  approxTokens: number;
  calls: number;
  lastCallAt: string;
  agentIds: string[];
}

/** Collapses per-(agent,provider,model) rows into one row per (provider,model), listing which agents have used it. */
function groupByModel(usage: ModelUsageStats[]): ModelRow[] {
  const byModel = new Map<string, ModelRow>();
  for (const row of usage) {
    const key = `${row.provider}:${row.model}`;
    const existing = byModel.get(key);
    if (existing) {
      existing.approxTokens += row.approxTokens;
      existing.calls += row.calls;
      existing.agentIds.push(row.agentId);
      if (row.lastCallAt > existing.lastCallAt) existing.lastCallAt = row.lastCallAt;
    } else {
      byModel.set(key, { provider: row.provider, model: row.model, approxTokens: row.approxTokens, calls: row.calls, lastCallAt: row.lastCallAt, agentIds: [row.agentId] });
    }
  }
  return [...byModel.values()].sort((a, b) => b.approxTokens - a.approxTokens);
}

/**
 * Token usage broken down per model, not just per provider — llm_usage (the
 * per-agent table) gets relabeled onto whichever model an agent most
 * recently used, so it can't answer "how many tokens has model X used";
 * this reads from llm_usage_by_model instead, which keeps every model's
 * own real running total.
 */
export function ModelUsagePanel({ usage }: ModelUsagePanelProps) {
  const rows = groupByModel(usage);
  const totalTokens = rows.reduce((sum, r) => sum + r.approxTokens, 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-elevated">
        <p className="text-[13px] font-semibold text-ink-faint">Token usage by model</p>
        <p className="mt-2 text-sm text-ink-faint">No calls recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-elevated">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink-faint">Token usage by model</p>
        <span className="font-mono text-[10px] text-ink-faint">{formatTokenCount(totalTokens)} total</span>
      </div>
      <ul className="mt-2 max-h-80 overflow-y-auto">
        {rows.map((row) => {
          const pct = totalTokens > 0 ? Math.round((row.approxTokens / totalTokens) * 100) : 0;
          return (
            <li key={`${row.provider}:${row.model}`} className="border-b border-line/60 py-2 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: providerColorHex(row.provider) }} />
                  <span className="truncate font-mono text-[11px] text-ink-muted" title={`${row.provider}/${row.model}`}>
                    {row.model}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink">{formatTokenCount(row.approxTokens)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[9px] text-ink-faint">
                <span className="truncate">
                  {row.provider} · used by {row.agentIds.join(', ')} · {row.calls} calls
                </span>
                <span className="shrink-0">{formatRelativeTime(row.lastCallAt)}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: providerColorHex(row.provider) }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
