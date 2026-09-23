'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { BriefRecord } from '@bharat-ai-office/shared';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export interface BriefStripProps {
  brief: BriefRecord | null;
  onSubmitBrief: (text: string) => Promise<void>;
  onAbandonProject: () => Promise<void>;
}

const STATUS_LABEL: Record<string, string> = {
  planning: 'Nova is planning…',
  in_progress: 'In progress',
  complete: 'Shipped',
};

export function BriefStrip({ brief, onSubmitBrief, onAbandonProject }: BriefStripProps) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);
  const [abandoning, setAbandoning] = useState(false);

  const showComposer = !brief || brief.status === 'complete';

  // A second click within 4s confirms; otherwise the confirm state quietly
  // expires so an accidental first click doesn't leave a live "abandon"
  // trap armed indefinitely.
  useEffect(() => {
    if (!confirmingAbandon) return;
    const timer = setTimeout(() => setConfirmingAbandon(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmingAbandon]);

  async function handleAbandon() {
    if (!confirmingAbandon) {
      setConfirmingAbandon(true);
      return;
    }
    setAbandoning(true);
    try {
      await onAbandonProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to abandon project.');
      setAbandoning(false);
      setConfirmingAbandon(false);
    }
  }

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
      <div className="border-b border-line bg-panel px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-center gap-2">
          {brief?.status === 'complete' && <Badge tone="green">✓ Shipped</Badge>}
          <div className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 transition-colors focus-within:border-violet/60 focus-within:ring-2 focus-within:ring-violet/20">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Give the office a brief…"
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            {error && <span className="shrink-0 text-[11px] text-magenta">{error}</span>}
          </div>
          <Button type="submit" variant="primary" tone="violet" disabled={submitting || !draft.trim()}>
            {submitting ? 'Sending…' : 'Send to Nova'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2.5 text-sm">
      <Badge tone="violet">{STATUS_LABEL[brief!.status] ?? brief!.status}</Badge>
      <p className="flex-1 truncate text-ink">{brief!.brief}</p>
      {brief!.etaMinutes != null && (
        <span className="shrink-0 font-mono text-[11px] text-ink-faint">ETA ~{brief!.etaMinutes}m</span>
      )}
      {error && <span className="shrink-0 text-[11px] text-magenta">{error}</span>}
      <Button
        variant="ghost"
        tone={confirmingAbandon ? 'magenta' : 'neutral'}
        size="sm"
        onClick={handleAbandon}
        disabled={abandoning}
        title={
          confirmingAbandon
            ? 'Click again to permanently abandon this project'
            : 'Abandon this project and start a new one'
        }
      >
        {abandoning ? 'Abandoning…' : confirmingAbandon ? 'Click to confirm' : 'Abandon project'}
      </Button>
    </div>
  );
}
