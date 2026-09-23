'use client';

import { useEffect, useRef, useState } from 'react';
import type { ModelUsageStats } from '@bharat-ai-office/shared';
import { getLlmUsageByModel } from '@/lib/daemonApi';

// Plain polling, not Realtime — llm_usage_by_model isn't in the
// supabase_realtime publication (it's a slower-moving breakdown view, not
// something that needs sub-second push the way the per-agent usage does).
const POLL_INTERVAL_MS = 20_000;

export function useModelUsage(): ModelUsageStats[] {
  const [usage, setUsage] = useState<ModelUsageStats[]>([]);
  const lastGood = useRef<ModelUsageStats[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const next = await getLlmUsageByModel();
        if (!cancelled) {
          lastGood.current = next;
          setUsage(next);
        }
      } catch {
        if (!cancelled) setUsage(lastGood.current);
      }
    }

    void refresh();
    const pollId = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, []);

  return usage;
}
