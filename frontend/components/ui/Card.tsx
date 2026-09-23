import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Elevated surface wrapper — replaces the repeated
 * `rounded-xl border border-line bg-panel p-4` div in every dashboard
 * panel with one shared, slightly more elevated (bg-surface) container.
 */
export function Card({ title, action, children, className = '', ...props }: CardProps) {
  return (
    <div className={`rounded-2xl border border-line bg-surface p-4 shadow-elevated ${className}`} {...props}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
