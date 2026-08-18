export interface HudBarProps {
  sessionId: string;
  connected: boolean;
  pendingApprovals: number;
  onOpenRecall: () => void;
  onOpenApprovals: () => void;
}

export function HudBar({ sessionId, connected, pendingApprovals, onOpenRecall, onOpenApprovals }: HudBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-void/90 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        {/* Restrained Bharat accent (PRD 7.1): saffron/india-green on brand chrome only. */}
        <span className="h-2 w-2 rounded-full bg-saffron" />
        <span className="h-2 w-2 rounded-full bg-[#E6EDF3]" />
        <span className="h-2 w-2 rounded-full bg-india-green" />
        <span className="ml-1 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#E6EDF3]">
          Bharat AI Office
        </span>
      </div>
      <div className="flex items-center gap-3 font-mono text-[11px] text-[#6B7686]">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green' : 'bg-magenta'}`} />
          {sessionId}
        </span>
        <button
          type="button"
          onClick={onOpenRecall}
          className="rounded border border-line px-2 py-1 uppercase tracking-wide text-cyan transition-colors hover:border-cyan"
        >
          ⌕ Recall
        </button>
        <button
          type="button"
          onClick={onOpenApprovals}
          className="relative rounded border border-line px-2 py-1 uppercase tracking-wide text-amber transition-colors hover:border-amber"
        >
          ⚑ Approvals
          {pendingApprovals > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-magenta text-[9px] text-void">
              {pendingApprovals}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
