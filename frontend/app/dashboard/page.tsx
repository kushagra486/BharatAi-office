'use client';

import { useHiveSocket } from '@/hooks/useHiveSocket';
import { useLlmUsage } from '@/hooks/useLlmUsage';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { HudBar } from '@/components/office/HudBar';
import { DashboardStatTiles } from '@/components/dashboard/DashboardStatTiles';
import { MeetingSummaryBoard } from '@/components/dashboard/MeetingSummaryBoard';
import { WorkingProjectsPanel } from '@/components/dashboard/WorkingProjectsPanel';
import { AgentsWorkGraph } from '@/components/dashboard/AgentsWorkGraph';
import { BestWorkerCard } from '@/components/dashboard/BestWorkerCard';
import { AgentMeshGraph } from '@/components/dashboard/AgentMeshGraph';
import { AgentRosterGrid } from '@/components/dashboard/AgentRosterGrid';

const SESSION_ID = 'OFFICE-001';

export default function DashboardPage() {
  const { ready } = useAuthGuard();
  const { connected, agents, tasks, messages, brief } = useHiveSocket();
  const usage = useLlmUsage();

  if (!ready) return null;

  return (
    <main className="flex min-h-screen flex-col bg-void">
      <HudBar sessionId={SESSION_ID} connected={connected} />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
        <DashboardStatTiles agents={agents} tasks={tasks} usage={usage} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MeetingSummaryBoard agents={agents} tasks={tasks} messages={messages} usage={usage} brief={brief} />
          </div>
          <WorkingProjectsPanel brief={brief} tasks={tasks} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AgentsWorkGraph agents={agents} tasks={tasks} />
          </div>
          <BestWorkerCard agents={agents} tasks={tasks} usage={usage} />
        </div>

        <AgentMeshGraph agents={agents} messages={messages} />

        <AgentRosterGrid agents={agents} />
      </div>
    </main>
  );
}
