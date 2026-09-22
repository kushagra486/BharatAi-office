'use client';

import { useEffect, useState } from 'react';
import { getAuthStatus } from '@/lib/daemonApi';
import { getToken } from '@/lib/authToken';

/**
 * Client-side gate for the protected pages (/, /dashboard, /status): if the
 * daemon requires a login and this browser has no token, redirect to
 * /login before rendering anything real. This is a UX convenience, not the
 * actual security boundary — the daemon itself rejects unauthenticated API
 * and WebSocket traffic (see daemon/src/auth/auth.ts), so a bypassed guard
 * still can't reach real data.
 *
 * Returns `ready` = false while the check is in flight, so callers can
 * render nothing rather than flashing protected content pre-redirect.
 */
export function useAuthGuard(): { ready: boolean } {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getAuthStatus();
        if (status.authRequired && !getToken()) {
          window.location.href = '/login';
          return;
        }
      } catch {
        // Daemon unreachable — let the page render as usual; its own
        // connection-status UI (the HUD's connected dot) covers this case.
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready };
}
