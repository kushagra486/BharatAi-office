'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useHiveSocket } from '@/hooks/useHiveSocket';
import { useLlmUsage } from '@/hooks/useLlmUsage';
import { approveEscalation, denyEscalation, submitBrief } from '@/lib/daemonApi';
import { HudBar } from '@/components/office/HudBar';
import { BriefStrip } from '@/components/office/BriefStrip';
import { ApprovalsDock } from '@/components/office/ApprovalsDock';
import { MemoryRecallPanel } from '@/components/office/MemoryRecallPanel';
import { EmployeeSidePanel } from '@/components/office/EmployeeSidePanel';
import { TeamRoster } from '@/components/office/TeamRoster';
import { TeamActivity } from '@/components/office/TeamActivity';

// Real-time 3D office floor — a Three.js scene with the team's actual 3D
// character models and CC0 furniture props (see components/office-3d/).
// Client-only: it owns a WebGLRenderer, so it's kept out of the server render.
const OfficeFloor3D = dynamic(() => import('@/components/office-3d/OfficeFloor3D').then((m) => m.OfficeFloor3D), {
  ssr: false,
});

const SESSION_ID = 'OFFICE-001';

export default function Home() {
  const { connected, agents, tasks, messages, escalations, memories, brief, agentOutputByAgent } = useHiveSocket();
  const usage = useLlmUsage();
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

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col p-4">
            <OfficeFloor3D agents={agents} tasks={tasks} messages={messages} onSelectAgent={setSelectedAgentId} />
          </div>
          <TeamRoster agents={agents} tasks={tasks} usage={usage} selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />
        </div>
        <TeamActivity messages={messages} />
      </div>

      <div id="approvals-dock">
        <ApprovalsDock escalations={escalations} onApprove={handleApprove} onDeny={handleDeny} />
      </div>

      <MemoryRecallPanel open={recallOpen} onClose={() => setRecallOpen(false)} memories={memories} />

      <EmployeeSidePanel
        agent={selectedAgent}
        tasks={tasks}
        messages={messages}
        terminalBuffer={selectedAgent ? agentOutputByAgent[selectedAgent.id] ?? '' : ''}
        usage={selectedAgent ? usage[selectedAgent.id] : undefined}
        onClose={() => setSelectedAgentId(null)}
      />
    </main>
  );
}
