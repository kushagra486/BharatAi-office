'use client';

import { useEffect, useRef } from 'react';
import type { HiveMessage, MessageType } from '@bharat-ai-office/shared';
import { MESSAGE_COLOR } from '@bharat-ai-office/shared';

export interface TeamActivityProps {
  messages: HiveMessage[];
}

const TYPE_LABEL: Record<MessageType, string> = {
  task: 'Task',
  handoff: 'Handoff',
  escalation: 'Escalation',
  report: 'Report',
};

export function TeamActivity({ messages }: TeamActivityProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // messages arrives newest-first (useHiveSocket unshifts); show it chronologically,
  // like a chat log, and keep the view pinned to the newest message.
  const chronological = [...messages].reverse();

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <section className="flex h-40 shrink-0 flex-col border-t border-line bg-panel/95">
      <div className="flex items-center gap-2 border-b border-line px-4 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#6B7686]">Team Activity</span>
        <span className="h-1.5 w-1.5 rounded-full bg-green" />
        <span className="font-mono text-[10px] text-[#6B7686]">live mailbox</span>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-4 py-2">
        {chronological.length === 0 && (
          <p className="pt-2 text-center font-mono text-[11px] text-[#6B7686]">No activity yet — nothing sent between agents.</p>
        )}
        {chronological.map((m) => (
          <div key={m.id} className="flex items-start gap-2 text-[11px]">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: MESSAGE_COLOR[m.type] }}
              title={TYPE_LABEL[m.type]}
            />
            <span className="min-w-0">
              <span className="font-mono text-violet">
                {m.from_agent} → {m.to_agent}
              </span>
              <span className="ml-1.5 text-[#C7D0DA]">{m.body}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
