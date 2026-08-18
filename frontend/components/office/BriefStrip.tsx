'use client';

import { useState, type FormEvent } from 'react';
import type { BriefRecord } from '@bharat-ai-office/shared';

export interface BriefStripProps {
  brief: BriefRecord | null;
  onSubmitBrief: (text: string) => Promise<void>;
}

const STATUS_LABEL: Record<string, string> = {
  planning: 'Nova is planning…',
  in_progress: 'In progress',
  complete: 'Shipped',
};

export function BriefStrip({ brief, onSubmitBrief }: BriefStripProps) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showComposer = !brief || brief.status === 'complete';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmitBrief(draft.trim());
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send brief.');
    } finally {
      setSubmitting(false);
    }
  }

  if (showComposer) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2.5">
        {brief?.status === 'complete' && (
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-green">✓ Shipped —</span>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Give the office a brief…"
          className="flex-1 bg-transparent font-mono text-sm text-[#E6EDF3] outline-none placeholder:text-[#6B7686]"
        />
        {error && <span className="shrink-0 font-mono text-[11px] text-magenta">{error}</span>}
        <button
          type="submit"
          disabled={submitting || !draft.trim()}
          className="shrink-0 rounded border border-cyan/50 px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-cyan transition-colors hover:bg-cyan/10 disabled:opacity-40"
        >
          {submitting ? 'Sending…' : 'Send to Nova'}
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2.5 font-mono text-xs">
      <span className="shrink-0 rounded bg-violet/10 px-2 py-0.5 uppercase tracking-wide text-violet">
        {STATUS_LABEL[brief!.status] ?? brief!.status}
      </span>
      <p className="flex-1 truncate text-[#E6EDF3]">{brief!.brief}</p>
      {brief!.etaMinutes != null && <span className="shrink-0 text-[#6B7686]">ETA ~{brief!.etaMinutes}m</span>}
    </div>
  );
}
