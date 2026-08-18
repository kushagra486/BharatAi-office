'use client';

import { useMemo, useState } from 'react';
import { useHiveSocket } from '@/hooks/useHiveSocket';
import { submitBrief } from '@/lib/daemonApi';
import { HudBar } from '@/components/office/HudBar';
import { BriefStrip } from '@/components/office/BriefStrip';
import { OfficeFloor } from '@/components/office/OfficeFloor';
import { ApprovalsDock } from '@/components/office/ApprovalsDock';
import { MemoryRecallPanel } from '@/components/office/MemoryRecallPanel';
import { EmployeeSidePanel } from '@/components/office/EmployeeSidePanel';

const SESSION_ID = 'OFFICE-001';

export default function Home() {
  const { connected, agents, tasks, messages, escalations, memories, brief, ptyOutputByAgent } = useHiveSocket();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [recallOpen, setRecallOpen] = useState(false);

  const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedAgentId) ?? null, [agents, selectedAgentId]);
  const pendingApprovals = useMemo(() => escalations.filter((e) => e.resolution === 'pending').length, [escalations]);

  // Approve/Deny handlers are wired to real daemon endpoints in Phase 6.
  function handleApprove(id: number) {
    console.warn(`TODO(Phase 6): approve escalation ${id}`);
  }
  function handleDeny(id: number) {
    console.warn(`TODO(Phase 6): deny escalation ${id}`);
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
        <OfficeFloor agents={agents} tasks={tasks} messages={messages} onSelectAgent={setSelectedAgentId} />
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
