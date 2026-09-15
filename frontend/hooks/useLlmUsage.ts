'use client';

import { useEffect, useRef, useState } from 'react';
import type { LlmUsageByAgent } from '@bharat-ai-office/shared';
import { getLlmUsage } from '@/lib/daemonApi';

const POLL_INTERVAL_MS = 7000;

/**
 * Polls GET /api/llm/usage rather than riding the WebSocket — usage isn't
 * event-driven (it changes on every LLM call, which would be a lot of
 * socket chatter for a number that's fine to be a few seconds stale) and
 * doesn't need to be real-time to be useful.
 */
export function useLlmUsage(): LlmUsageByAgent {
  const [usage, setUsage] = useState<LlmUsageByAgent>({});
  const lastGood = useRef<LlmUsageByAgent>({});

  useEffect(() => {
    let cancelled = false;

    async function poll() {
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

    void poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return usage;
}
