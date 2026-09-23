'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClock } from '@/hooks/useClock';
import { getToken } from '@/lib/authToken';
import { logout } from '@/lib/daemonApi';
import { Button } from '@/components/ui/Button';

export interface HudBarProps {
  sessionId: string;
  connected: boolean;
  // Recall/Approvals only apply to the office floor page — omit both on
  // pages that don't have that dock/modal mounted, and the buttons hide.
  pendingApprovals?: number;
  onOpenRecall?: () => void;
  onOpenApprovals?: () => void;
}

const NAV_LINKS = [
  { href: '/', label: 'Office' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/status', label: 'Status' },
];

function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-0.5 rounded-full border border-line/60 bg-surface/60 p-0.5 sm:flex">
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
              active ? 'bg-violet/15 text-violet' : 'text-ink-faint hover:text-ink'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Only rendered once we know there's actually a session token to log out
// of — otherwise (no APP_PASSWORD configured) a "Logout" button would be
// confusing chrome with nothing behind it.
function LogoutButton() {
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => setHasToken(Boolean(getToken())), []);
  if (!hasToken) return null;

  return (
    <Button variant="ghost" tone="magenta" size="sm" onClick={() => logout().finally(() => (window.location.href = '/login'))}>
      Logout
    </Button>
  );
}

/**
 * Mobile-only page switcher — SiteNav's own links are `hidden` below `sm`
 * (there isn't room for brand + clock + 3 nav links + status + action
 * buttons on one ~375px-wide row), so this is a second row in the same
 * sticky header instead: page switching stays reachable from the top bar
 * on every page, at a real touch-target height, rather than disappearing
 * on phones or moving into a hamburger/overlay.
 */
function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-stretch border-t border-line/60 sm:hidden">
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`min-h-11 flex-1 py-2.5 text-center text-[13px] font-medium transition-colors ${
              active ? 'bg-violet/10 text-violet' : 'text-ink-faint active:bg-line/30'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function HudBar({ sessionId, connected, pendingApprovals, onOpenRecall, onOpenApprovals }: HudBarProps) {
  const now = useClock();

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-line bg-void/90 backdrop-blur relative">
      {/* Modern-UI accent: a slow gradient sweep along the top edge, purely decorative. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px animate-shimmer bg-[length:200%_100%]"
        style={{
          backgroundImage: 'linear-gradient(90deg, transparent, #2FE6D2, #8B7CF6, #FFB454, transparent)',
        }}
      />
      <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {/* Restrained Bharat accent (PRD 7.1): saffron/india-green on brand chrome only. */}
          <span className="h-2 w-2 rounded-full bg-saffron" />
          <span className="h-2 w-2 rounded-full bg-ink" />
          <span className="h-2 w-2 rounded-full bg-india-green" />
          <span className="ml-1 text-[13px] font-semibold tracking-tight text-ink">Bharat AI Office</span>
        </div>

        <div className="hidden h-4 w-px bg-line sm:block" />

        <div className="hidden items-center gap-2 font-mono text-[11px] text-ink-faint sm:flex">
          <span className="rounded-lg border border-line px-2 py-1 tabular-nums">
            {now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </span>
          <span className="rounded-lg border border-line px-2 py-1">
            {now ? now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </span>
        </div>

        <div className="hidden h-4 w-px bg-line md:block" />
        <SiteNav />
      </div>

      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-faint" title={sessionId}>
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              connected ? 'bg-green text-green animate-glow-pulse' : 'bg-magenta'
            }`}
          />
          <span className="hidden sm:inline">{sessionId}</span>
        </span>
        {onOpenRecall && (
          <Button variant="ghost" tone="cyan" size="sm" onClick={onOpenRecall} aria-label="Open memory recall search">
            ⌕<span className="hidden sm:inline"> Recall</span>
          </Button>
        )}
        {onOpenApprovals && (
          <Button
            variant="ghost"
            tone="amber"
            size="sm"
            onClick={onOpenApprovals}
            className="relative"
            aria-label={`Open approvals${pendingApprovals ? `, ${pendingApprovals} pending` : ''}`}
          >
            ⚑<span className="hidden sm:inline"> Approvals</span>
            {!!pendingApprovals && pendingApprovals > 0 && (
              <span
                key={pendingApprovals}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 animate-pop-in items-center justify-center rounded-full bg-magenta text-[9px] text-void shadow-[0_0_6px_1px_#FF4D6D]"
              >
                {pendingApprovals}
              </span>
            )}
          </Button>
        )}
        <LogoutButton />
      </div>
      </div>
      <MobileNav />
    </header>
  );
}
