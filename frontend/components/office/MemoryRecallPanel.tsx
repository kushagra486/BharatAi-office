'use client';

import { useMemo, useState } from 'react';
import type { MemoryEntry } from '@bharat-ai-office/shared';

export interface MemoryRecallPanelProps {
  open: boolean;
  onClose: () => void;
  memories: MemoryEntry[];
}

export function MemoryRecallPanel({ open, onClose, memories }: MemoryRecallPanelProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return memories;
    return memories.filter(
      (m) => m.content.toLowerCase().includes(q) || m.tag.toLowerCase().includes(q) || m.agent_id.toLowerCase().includes(q)
    );
  }, [memories, query]);

  if (!open) return null;

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
          {filtered.length === 0 && <p className="p-4 text-center font-mono text-xs text-[#6B7686]">No matches.</p>}
          {filtered.map((m) => (
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
