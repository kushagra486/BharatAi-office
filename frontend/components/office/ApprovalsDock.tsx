import type { Escalation } from '@bharat-ai-office/shared';
import { Button } from '@/components/ui/Button';

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
        <div className="flex shrink-0 flex-col justify-center pr-3">
          <span className="text-[13px] font-semibold text-amber">⚑ Approvals</span>
          <span className="font-mono text-[10px] text-ink-faint">{pending.length} pending</span>
        </div>

        {pending.length === 0 && resolved.length === 0 && (
          <div className="flex items-center text-[13px] text-ink-faint">Nothing needs you right now.</div>
        )}

        {pending.map((esc) => (
          <div
            key={esc.id}
            className="flex min-w-[260px] shrink-0 animate-fade-slide-up flex-col justify-between gap-2 rounded-2xl border border-amber/40 bg-amber/5 p-3.5 shadow-[0_0_14px_-6px_#FFB454]"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-amber">{esc.agent_id}</div>
              <p className="mt-1 text-[13px] text-ink">{esc.description}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" tone="green" size="sm" onClick={() => onApprove(esc.id)} className="flex-1">
                Approve
              </Button>
              <Button variant="secondary" tone="magenta" size="sm" onClick={() => onDeny(esc.id)} className="flex-1">
                Deny
              </Button>
            </div>
          </div>
        ))}

        {resolved.map((esc) => (
          <div
            key={esc.id}
            className={`flex min-w-[220px] shrink-0 flex-col justify-center gap-1 rounded-2xl border p-3.5 opacity-50 transition-opacity duration-300 animate-fade-slide-up ${
              esc.resolution === 'approved' ? 'border-green/30' : 'border-magenta/30'
            }`}
          >
            <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
              {esc.agent_id} · {esc.resolution}
            </div>
            <p className="line-clamp-2 text-[13px] text-ink-muted">{esc.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
