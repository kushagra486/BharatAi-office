'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClock } from '@/hooks/useClock';
import { getToken } from '@/lib/authToken';
import { logout } from '@/lib/daemonApi';

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
    <nav className="hidden items-center gap-1 sm:flex">
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded px-2 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors ${
              active ? 'bg-line/60 text-[#E6EDF3]' : 'text-[#6B7686] hover:text-[#E6EDF3]'
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
    <button
      type="button"
      onClick={() => logout().finally(() => (window.location.href = '/login'))}
      className="rounded border border-line px-2.5 py-1.5 uppercase tracking-wide text-[#6B7686] transition-all duration-200 hover:border-magenta hover:text-magenta active:scale-95 sm:px-2 sm:py-1"
    >
      Logout
    </button>
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
            className={`flex-1 py-2.5 text-center font-mono text-[11px] uppercase tracking-wide transition-colors ${
              active ? 'bg-line/60 text-[#E6EDF3]' : 'text-[#6B7686] active:bg-line/30'
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
      <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {/* Restrained Bharat accent (PRD 7.1): saffron/india-green on brand chrome only. */}
          <span className="h-2 w-2 rounded-full bg-saffron" />
          <span className="h-2 w-2 rounded-full bg-[#E6EDF3]" />
          <span className="h-2 w-2 rounded-full bg-india-green" />
          <span className="ml-1 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#E6EDF3]">
            Bharat AI Office
          </span>
        </div>

        <div className="hidden h-4 w-px bg-line sm:block" />

        <div className="hidden items-center gap-2 font-mono text-[11px] text-[#6B7686] sm:flex">
          <span className="rounded border border-line px-2 py-1 tabular-nums">
            {now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </span>
          <span className="rounded border border-line px-2 py-1">
            {now ? now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </span>
        </div>

        <div className="hidden h-4 w-px bg-line md:block" />
        <SiteNav />
      </div>

      <div className="flex items-center gap-3 font-mono text-[11px] text-[#6B7686]">
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              connected ? 'bg-green text-green animate-glow-pulse' : 'bg-magenta'
            }`}
          />
          {sessionId}
        </span>
        {onOpenRecall && (
          <button
            type="button"
            onClick={onOpenRecall}
            className="rounded border border-line px-2.5 py-1.5 uppercase tracking-wide text-cyan transition-all duration-200 hover:scale-105 hover:border-cyan hover:shadow-[0_0_10px_-2px_#2FE6D2] active:scale-95 sm:px-2 sm:py-1"
          >
            ⌕ Recall
          </button>
        )}
        {onOpenApprovals && (
          <button
            type="button"
            onClick={onOpenApprovals}
            className="relative rounded border border-line px-2.5 py-1.5 uppercase tracking-wide text-amber transition-all duration-200 hover:scale-105 hover:border-amber hover:shadow-[0_0_10px_-2px_#FFB454] active:scale-95 sm:px-2 sm:py-1"
          >
            ⚑ Approvals
            {!!pendingApprovals && pendingApprovals > 0 && (
              <span
                key={pendingApprovals}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 animate-pop-in items-center justify-center rounded-full bg-magenta text-[9px] text-void shadow-[0_0_6px_1px_#FF4D6D]"
              >
                {pendingApprovals}
              </span>
            )}
          </button>
        )}
        <LogoutButton />
      </div>
      </div>
      <MobileNav />
    </header>
  );
}
