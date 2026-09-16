'use client';

import { useHiveSocket } from '@/hooks/useHiveSocket';
import { HudBar } from '@/components/office/HudBar';
import { AgentStatusGrid } from '@/components/status/AgentStatusGrid';

const SESSION_ID = 'OFFICE-001';

export default function StatusPage() {
  const { connected, agents, tasks, escalations } = useHiveSocket();
  const workingCount = tasks.filter((t) => t.status === 'working').length;

  return (
    <main className="flex min-h-screen flex-col bg-void">
      <HudBar sessionId={SESSION_ID} connected={connected} />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
        <div className="flex items-baseline justify-between">
          <h1 className="font-mono text-sm uppercase tracking-wide text-[#E6EDF3]">Job suggestions &amp; current status</h1>
          <p className="font-mono text-[11px] text-[#6B7686]">{workingCount} of {agents.length} agents working right now</p>
        </div>
        <AgentStatusGrid agents={agents} tasks={tasks} escalations={escalations} />
      </div>
    </main>
  );
}
