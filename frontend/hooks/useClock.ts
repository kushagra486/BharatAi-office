'use client';

import { useEffect, useState } from 'react';

/** Ticks a Date every second. Null on first render, to avoid an SSR/client markup mismatch. */
export function useClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
