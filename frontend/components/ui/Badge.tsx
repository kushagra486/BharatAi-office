import type { HTMLAttributes } from 'react';

export type BadgeTone = 'violet' | 'cyan' | 'amber' | 'green' | 'magenta' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  mono?: boolean;
}

const TONE_HEX: Record<BadgeTone, string> = {
  violet: '#8B7CF6',
  cyan: '#2FE6D2',
  amber: '#FFB454',
  green: '#4ADE80',
  magenta: '#FF4D6D',
  neutral: '#6B7686',
};

/** Small status/tag pill — replaces inline `rounded ... px-2 py-0.5` spans scattered across panels. */
export function Badge({ tone = 'neutral', mono = false, className = '', style, ...props }: BadgeProps) {
  const hex = TONE_HEX[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${mono ? 'font-mono uppercase tracking-wide' : ''} ${className}`}
      style={{ color: hex, backgroundColor: `${hex}1A`, ...style }}
      {...props}
    />
  );
}
