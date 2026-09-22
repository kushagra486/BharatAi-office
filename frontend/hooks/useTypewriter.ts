'use client';

import { useEffect, useRef, useState } from 'react';

const MIN_CHARS_PER_TICK = 2;
const CATCH_UP_DIVISOR = 10; // reveal ~1/10th of the backlog per frame, so a big chunk still snaps in fast

/**
 * Reveals `text` progressively instead of swapping it in all at once, so
 * the employee side panel's terminal feed reads as a live typewriter
 * (PRD §7.2.7) rather than a plain log dump. Falls back to an instant jump
 * when `text` isn't a simple extension of what's already shown — switching
 * to a different agent, or the daemon's capped buffer trimming its start —
 * rather than "typing" a reset.
 */
export function useTypewriter(text: string): string {
  const [display, setDisplay] = useState(text);
  const shownRef = useRef(text);
  const targetRef = useRef(text);
  const rafRef = useRef<number | null>(null);

  targetRef.current = text;

  useEffect(() => {
    if (!text.startsWith(shownRef.current)) {
      shownRef.current = text;
      setDisplay(text);
      return;
    }
    if (rafRef.current !== null) return; // a catch-up loop is already running

    function tick() {
      const target = targetRef.current;
      const shown = shownRef.current;
      if (shown.length >= target.length) {
        rafRef.current = null;
        return;
      }
      const remaining = target.length - shown.length;
      const step = Math.max(MIN_CHARS_PER_TICK, Math.ceil(remaining / CATCH_UP_DIVISOR));
      shownRef.current = target.slice(0, shown.length + step);
      setDisplay(shownRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [text]);

  return display;
}

/** True while `useTypewriter`'s returned text is still catching up to `fullText`. */
export function isTyping(displayed: string, fullText: string): boolean {
  return displayed.length < fullText.length;
}
