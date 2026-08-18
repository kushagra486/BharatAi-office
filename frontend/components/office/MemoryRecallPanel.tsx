'use client';

import { useEffect, useState } from 'react';
import type { MemoryEntry } from '@bharat-ai-office/shared';
import { searchMemory } from '@/lib/daemonApi';

const DEBOUNCE_MS = 250;

export interface MemoryRecallPanelProps {
  open: boolean;
  onClose: () => void;
  /** Live memory entries from the socket, shown immediately while a query is being typed/debounced. */
  memories: MemoryEntry[];
}

export function MemoryRecallPanel({ open, onClose, memories }: MemoryRecallPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults(null); // show live `memories` when there's no query
      return;
    }
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

  const list = results ?? memories;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-void/70 p-6 pt-24 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl rounded-xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Memory recall"
      >
        <div className="border-b border-line p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="⌕ Recall memory…"
            className="w-full bg-transparent font-mono text-sm text-[#E6EDF3] outline-none placeholder:text-[#6B7686]"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && <p className="p-4 text-center font-mono text-xs text-[#6B7686]">Searching…</p>}
          {!loading && list.length === 0 && <p className="p-4 text-center font-mono text-xs text-[#6B7686]">No matches.</p>}
          {!loading &&
            list.map((m) => (
              <div key={m.id} className="rounded-lg p-3 hover:bg-line/20">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-violet">
                  <span>{m.agent_id}</span>
                  <span className="text-[#6B7686]">·</span>
                  <span>{m.tag}</span>
                </div>
                <p className="mt-1 text-xs text-[#C7D0DA]">{m.content}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
