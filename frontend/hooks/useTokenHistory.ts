import { useEffect, useRef, useState } from 'react';

const MAX_SAMPLES = 24;
const SAMPLE_INTERVAL_MS = 5000;

/**
 * Samples `value` on a fixed interval (independent of when it actually
 * changes) so the returned series is a real time axis — flat stretches
 * during quiet periods are as meaningful as the climbs — for the live
 * token sparkline in TeamRoster.
 */
export function useTokenHistory(value: number): number[] {
  const [history, setHistory] = useState<number[]>([]);
  const latestRef = useRef(value);
  latestRef.current = value;

  useEffect(() => {
    const id = setInterval(() => {
      setHistory((prev) => {
        const next = [...prev, latestRef.current];
        return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
      });
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return history;
}
