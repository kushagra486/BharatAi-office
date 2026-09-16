import type { Escalation } from '@bharat-ai-office/shared';

export interface ApprovalsDockProps {
  escalations: Escalation[];
  onApprove: (id: number) => void;
  onDeny: (id: number) => void;
}

export function ApprovalsDock({ escalations, onApprove, onDeny }: ApprovalsDockProps) {
  const pending = escalations.filter((e) => e.resolution === 'pending');
  // Resolved cards fade rather than disappear — an audit trail, not a queue (PRD 7.2).
  const resolved = escalations.filter((e) => e.resolution !== 'pending').slice(0, 8);

  return (
    <div className="sticky bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur">
      <div className="flex items-stretch gap-3 overflow-x-auto px-4 py-3">
        <div className="flex shrink-0 flex-col justify-center pr-3 font-mono text-[10px] uppercase tracking-wider text-amber">
          <span>⚑ Approvals</span>
          <span className="text-[#6B7686]">{pending.length} pending</span>
        </div>

        {pending.length === 0 && resolved.length === 0 && (
          <div className="flex items-center font-mono text-[11px] text-[#6B7686]">Nothing needs you right now.</div>
        )}

        {pending.map((esc) => (
          <div
            key={esc.id}
            className="flex min-w-[260px] shrink-0 animate-fade-slide-up flex-col justify-between gap-2 rounded-lg border border-amber/40 bg-amber/5 p-3 shadow-[0_0_14px_-6px_#FFB454]"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-amber">{esc.agent_id}</div>
              <p className="mt-1 text-xs text-[#E6EDF3]">{esc.description}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onApprove(esc.id)}
                className="flex-1 rounded border border-green/50 bg-green/10 py-1 font-mono text-[10px] uppercase text-green transition-all duration-150 hover:scale-105 hover:bg-green/20 active:scale-95"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => onDeny(esc.id)}
                className="flex-1 rounded border border-magenta/50 bg-magenta/10 py-1 font-mono text-[10px] uppercase text-magenta transition-all duration-150 hover:scale-105 hover:bg-magenta/20 active:scale-95"
              >
                Deny
              </button>
            </div>
          </div>
        ))}

        {resolved.map((esc) => (
          <div
            key={esc.id}
            className={`flex min-w-[220px] shrink-0 flex-col justify-center gap-1 rounded-lg border p-3 opacity-50 transition-opacity duration-300 animate-fade-slide-up ${
              esc.resolution === 'approved' ? 'border-green/30' : 'border-magenta/30'
            }`}
          >
            <div className="font-mono text-[10px] uppercase tracking-wide text-[#6B7686]">
              {esc.agent_id} · {esc.resolution}
            </div>
            <p className="line-clamp-2 text-xs text-[#8B96A5]">{esc.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
