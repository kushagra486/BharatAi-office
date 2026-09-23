'use client';

import { useEffect, useState } from 'react';
import type { MemoryEntry } from '@bharat-ai-office/shared';
import { searchMemory } from '@/lib/daemonApi';

const DEBOUNCE_MS = 250;

export interface MemoryRecallPanelProps {
  open: boolean;
  onClose: () => void;
}

// `memory` isn't on the Supabase Realtime publication (see the
// initial_hive_schema migration) — it's an append-only log, not something
// that needs live push updates the way tasks/messages/escalations do, so
// the "no query yet" default view is just an on-open fetch (searchMemory('')
// already returns the most recent entries) instead of a live-socket-fed prop.
export function MemoryRecallPanel({ open, onClose }: MemoryRecallPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    setLoading(true);
    const timer = setTimeout(() => {
      searchMemory(q)
        .then((found) => setResults(found))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;

  const list = results;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-void/70 p-6 pt-24 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-line bg-surface shadow-elevated"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Memory recall"
      >
        <div className="border-b border-line p-3.5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="⌕ Recall memory…"
            className="w-full rounded-lg bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-violet/30"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && <p className="p-4 text-center text-xs text-ink-faint">Searching…</p>}
          {!loading && list.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">No matches.</p>}
          {!loading &&
            list.map((m) => (
              <div key={m.id} className="rounded-xl p-3 transition-colors hover:bg-line/20">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-violet">
                  <span>{m.agent_id}</span>
                  <span className="text-ink-faint">·</span>
                  <span>{m.tag}</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">{m.content}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
