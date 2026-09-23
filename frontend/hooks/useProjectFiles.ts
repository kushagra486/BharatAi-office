'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProjectFile } from '@bharat-ai-office/shared';
import { listProjectFiles } from '@/lib/daemonApi';

// Storage object changes aren't Postgres rows, so there's no Realtime
// channel to subscribe to here (unlike useLlmUsage) — plain polling is the
// only option. Files only change right after a commit, not continuously,
// so a slower interval than the LLM usage poll is fine.
const POLL_INTERVAL_MS = 15_000;

export function useProjectFiles(): ProjectFile[] {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const lastGood = useRef<ProjectFile[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const next = await listProjectFiles();
        if (!cancelled) {
          lastGood.current = next;
          setFiles(next);
        }
      } catch {
        if (!cancelled) setFiles(lastGood.current);
      }
    }

    void refresh();
    const pollId = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, []);

  return files;
}
