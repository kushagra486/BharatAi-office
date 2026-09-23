import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonTone = 'violet' | 'cyan' | 'amber' | 'green' | 'magenta' | 'neutral';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: 'sm' | 'md';
}

// Hex per tone rather than Tailwind color classes — several variants need
// the same color for border/text/ring/shadow at once, and arbitrary-value
// utilities (`border-[--tone]`) can't share one JS-computed value cleanly.
const TONE_HEX: Record<ButtonTone, string> = {
  violet: '#8B7CF6',
  cyan: '#2FE6D2',
  amber: '#FFB454',
  green: '#4ADE80',
  magenta: '#FF4D6D',
  neutral: '#E6EDF3',
};

/**
 * Shared interactive control — every button in the app should render
 * through this instead of a one-off `rounded border ...` className, so
 * hover/active/focus/disabled/touch-target behavior stays consistent.
 * `tone` keeps each call site's existing semantic color (cyan=live,
 * amber=warning, green=success, magenta=danger); `variant` controls visual
 * weight (filled vs outline vs bare).
 */
export function Button({
  variant = 'secondary',
  tone = 'violet',
  size = 'md',
  className = '',
  style,
  disabled,
  ...props
}: ButtonProps) {
  const hex = TONE_HEX[tone];
  const sizeClasses = size === 'sm' ? 'min-h-8 px-2.5 py-1 text-[11px]' : 'min-h-11 px-4 py-2 text-sm sm:min-h-9';

  const variantClasses =
    variant === 'primary'
      ? 'border font-medium text-void hover:brightness-110'
      : variant === 'secondary'
        ? 'border bg-transparent font-medium hover:bg-[var(--tone-bg)]'
        : 'border border-transparent bg-transparent font-medium hover:bg-line/30';

  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl transition-all duration-150 hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${sizeClasses} ${variantClasses} ${className}`}
      style={{
        borderColor: variant === 'ghost' ? undefined : hex,
        backgroundColor: variant === 'primary' ? hex : undefined,
        color: variant === 'primary' ? undefined : hex,
        // Ring color / hover-bg tint have to go through CSS vars since Tailwind's
        // ring-*/bg-* utilities can't take a JS-computed hex directly.
        ['--tw-ring-color' as string]: hex,
        ['--tone-bg' as string]: `${hex}1A`,
        ...style,
      }}
      {...props}
    />
  );
}
