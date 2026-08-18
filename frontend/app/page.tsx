'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useHiveSocket } from '@/hooks/useHiveSocket';
import { approveEscalation, denyEscalation, submitBrief } from '@/lib/daemonApi';
import { HudBar } from '@/components/office/HudBar';
import { BriefStrip } from '@/components/office/BriefStrip';
import { ApprovalsDock } from '@/components/office/ApprovalsDock';
import { MemoryRecallPanel } from '@/components/office/MemoryRecallPanel';
import { EmployeeSidePanel } from '@/components/office/EmployeeSidePanel';

// Pixel-art office floor (see /root/.claude/plans/synchronous-yawning-unicorn.md).
// Client-only: it owns a PIXI.Application (WebGL/canvas), so it's kept out
// of the server render even though it doesn't strictly require ssr:false
// today (see the migration's build notes).
const OfficeFloorPixel = dynamic(
  () => import('@/components/office-pixel/OfficeFloorPixel').then((m) => m.OfficeFloorPixel),
  { ssr: false }
);

const SESSION_ID = 'OFFICE-001';

export default function Home() {
  const { connected, agents, tasks, messages, escalations, memories, brief, ptyOutputByAgent } = useHiveSocket();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [recallOpen, setRecallOpen] = useState(false);

  const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedAgentId) ?? null, [agents, selectedAgentId]);
  const pendingApprovals = useMemo(() => escalations.filter((e) => e.resolution === 'pending').length, [escalations]);

  // The resulting escalation:resolved event comes back over the socket, so
  // no local optimistic update is needed here.
  function handleApprove(id: number) {
    approveEscalation(id).catch((err) => console.error('failed to approve escalation', id, err));
  }
  function handleDeny(id: number) {
    denyEscalation(id).catch((err) => console.error('failed to deny escalation', id, err));
  }

  return (
    <main className="flex min-h-screen flex-col bg-void">
      <HudBar
        sessionId={SESSION_ID}
        connected={connected}
        pendingApprovals={pendingApprovals}
        onOpenRecall={() => setRecallOpen(true)}
        onOpenApprovals={() => document.getElementById('approvals-dock')?.scrollIntoView({ behavior: 'smooth' })}
      />
      <BriefStrip brief={brief} onSubmitBrief={submitBrief} />

      <div className="flex-1 p-4">
        <OfficeFloorPixel agents={agents} tasks={tasks} messages={messages} onSelectAgent={setSelectedAgentId} />
      </div>

      <div id="approvals-dock">
        <ApprovalsDock escalations={escalations} onApprove={handleApprove} onDeny={handleDeny} />
      </div>

      <MemoryRecallPanel open={recallOpen} onClose={() => setRecallOpen(false)} memories={memories} />

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
