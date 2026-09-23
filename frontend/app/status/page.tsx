'use client';

import { useHiveSocket } from '@/hooks/useHiveSocket';
import { useLlmUsage } from '@/hooks/useLlmUsage';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { HudBar } from '@/components/office/HudBar';
import { AgentStatusGrid } from '@/components/status/AgentStatusGrid';

const SESSION_ID = 'OFFICE-001';

export default function StatusPage() {
  const { ready } = useAuthGuard();
  const { connected, agents, tasks, escalations } = useHiveSocket();
  const usage = useLlmUsage();
  const workingCount = tasks.filter((t) => t.status === 'working').length;

  if (!ready) return null;

  return (
    <main className="flex min-h-screen flex-col bg-void">
      <HudBar sessionId={SESSION_ID} connected={connected} />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold text-ink">Job suggestions &amp; current status</h1>
          <p className="font-mono text-[11px] text-ink-faint">{workingCount} of {agents.length} agents working right now</p>
        </div>
        <AgentStatusGrid agents={agents} tasks={tasks} escalations={escalations} usage={usage} />
      </div>
    </main>
  );
}
