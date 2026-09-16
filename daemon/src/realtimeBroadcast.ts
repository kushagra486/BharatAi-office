import { supabaseHive } from '@bharat-ai-office/shared/server';

// The employee side panel's live terminal feed (AgentRunner's output/exit
// events) rides a Supabase Realtime *broadcast* channel rather than a
// table+postgres_changes — these chunks are high-frequency and meant to be
// seen live, not queried or persisted, so a table would be the wrong tool
// (see frontend/hooks/useHiveSocket.ts's matching subscriber).
const CHANNEL_NAME = 'agent-events';
let channel: ReturnType<ReturnType<typeof supabaseHive.db>['channel']> | null = null;
let ready: Promise<void> | null = null;

function getChannel() {
  if (channel) return channel;
  channel = supabaseHive.db().channel(CHANNEL_NAME);
  ready = new Promise((resolve) => {
    channel!.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
    });
  });
  return channel;
}

export async function publishAgentEvent(event: 'output' | 'exit', payload: object): Promise<void> {
  const ch = getChannel();
  await ready;
  await ch.send({ type: 'broadcast', event, payload });
}
