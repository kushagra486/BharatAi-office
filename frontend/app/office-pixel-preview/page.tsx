'use client';

// Temporary standalone preview route for the pixel-art office floor
// migration (see /root/.claude/plans/synchronous-yawning-unicorn.md).
// Not linked from anywhere in the app; removed once OfficeFloorPixel is
// cut over into app/page.tsx and validated.

import { useMemo, useState } from 'react';
import { useHiveSocket } from '@/hooks/useHiveSocket';
import { OfficeFloorPixel } from '@/components/office-pixel/OfficeFloorPixel';
import { EmployeeSidePanel } from '@/components/office/EmployeeSidePanel';

export default function OfficePixelPreview() {
  const { agents, tasks, messages, ptyOutputByAgent } = useHiveSocket();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedAgentId) ?? null, [agents, selectedAgentId]);

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-void p-4">
      <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7686]">
        Pixel-art office floor preview — {agents.length} agents connected
      </p>
      <OfficeFloorPixel agents={agents} tasks={tasks} messages={messages} onSelectAgent={setSelectedAgentId} />
      <EmployeeSidePanel
        agent={selectedAgent}
        tasks={tasks}
        messages={messages}
        terminalBuffer={selectedAgent ? ptyOutputByAgent[selectedAgent.id] ?? '' : ''}
        onClose={() => setSelectedAgentId(null)}
      />
    </main>
  );
}
