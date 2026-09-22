'use client';

import { useEffect, useRef, useState } from 'react';
import type { LlmUsageByAgent, LlmUsageStats } from '@bharat-ai-office/shared';
import { getLlmUsage } from '@/lib/daemonApi';
import { getSupabaseClient } from '@/lib/supabaseClient';

// Safety-net only, not the primary refresh path — Realtime postgres_changes
// (see below) pushes updates the moment record_llm_usage writes a row, so
// this just guards against a missed/dropped Realtime event.
const FALLBACK_POLL_INTERVAL_MS = 30_000;

interface LlmUsageRow {
  agent_id: string;
  provider: string;
  model: string;
  calls: number;
  approx_tokens: number;
  last_call_at: string;
}

function rowToStats(row: LlmUsageRow): LlmUsageStats {
  return { provider: row.provider, model: row.model, calls: row.calls, approxTokens: row.approx_tokens, lastCallAt: row.last_call_at };
}

/**
 * Live per-agent LLM usage (provider, model, tokens, calls) — an initial
 * fetch for first paint, then Supabase Realtime postgres_changes on
 * llm_usage for true push updates (llm_usage was added to the
 * supabase_realtime publication with a public-read RLS policy specifically
 * for this). A slow poll runs alongside as a safety net in case a Realtime
 * event is ever missed, not as the primary mechanism.
 */
export function useLlmUsage(): LlmUsageByAgent {
  const [usage, setUsage] = useState<LlmUsageByAgent>({});
  const lastGood = useRef<LlmUsageByAgent>({});

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const next = await getLlmUsage();
        if (!cancelled) {
          lastGood.current = next;
          setUsage(next);
        }
      } catch {
        // Keep showing the last known-good usage rather than blanking the
        // UI on a transient fetch failure.
        if (!cancelled) setUsage(lastGood.current);
      }
    }

    void refresh();
    const pollId = setInterval(refresh, FALLBACK_POLL_INTERVAL_MS);

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('llm-usage-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'llm_usage' }, (payload) => {
        const row = (payload.new ?? payload.old) as LlmUsageRow | null;
        if (!row) return;
        lastGood.current = { ...lastGood.current, [row.agent_id]: rowToStats(row) };
        setUsage(lastGood.current);
      })
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, []);

  return usage;
}
