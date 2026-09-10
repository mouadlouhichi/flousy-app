'use client';

import type { ReactNode } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { MoneyFigure } from '@/components/ui/money-figure';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: string;
  title: string;
  value: number;
  caption?: string;
  /** "+27%" style delta chip next to the figure. */
  delta?: { label: string; positive: boolean } | null;
  redacted?: boolean;
  onClick?: () => void;
  /** Accessible action name when the card is clickable. */
  actionLabel?: string;
  variant?: 'default' | 'forest' | 'lime';
  /** Extra content under the figure (avatars, sparkline…). */
  children?: ReactNode;
  className?: string;
}

/**
 * Compact KPI tile ("Expenses · $4,570 · +27% · This Month") with the small
 * dollar chip and the diagonal arrow affordance from the reference design.
 */
export function StatCard({
  icon,
  title,
  value,
  caption,
  delta,
  redacted,
  onClick,
  actionLabel,
  variant = 'default',
  children,
  className,
}: StatCardProps) {
  const isDark = variant === 'forest';
  const isLime = variant === 'lime';
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative flex min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-[1.75rem] p-4 text-start transition-all',
        isDark
          ? 'surface-forest shadow-forest'
          : isLime
            ? 'surface-lime'
            : 'bg-surface-container-lowest border border-outline-variant shadow-ambient',
        onClick && 'hover:-translate-y-0.5 hover:shadow-floating focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:translate-y-0',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-2">
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full',
              isDark ? 'bg-lime text-forest-deep' : isLime ? 'bg-forest text-lime' : 'bg-lime text-forest-deep',
            )}
          >
            <AppIcon name={icon} strokeWidth={2.2} className="text-[14px]" />
          </span>
          <span className={cn('line-clamp-2 text-[13px] font-semibold leading-snug', isDark ? 'text-white' : 'text-on-surface')}>
            {title}
          </span>
        </span>
        {onClick && (
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
              isDark ? 'text-white/70' : 'text-on-surface-variant',
            )}
          >
            <AppIcon name="arrow_outward" strokeWidth={2} className="text-[18px] rtl:-scale-x-100" />
          </span>
        )}
      </div>

      {children}

      <div className="mt-3 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <MoneyFigure
            value={value}
            size="lg"
            redacted={redacted}
            tone={isDark ? 'accent' : 'default'}
            className={cn(isDark ? 'text-white' : isLime ? 'text-forest-deep' : 'text-on-surface')}
          />
          {delta && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                delta.positive
                  ? isDark
                    ? 'bg-lime text-forest-deep'
                    : 'bg-lime text-forest-deep'
                  : 'bg-error-container text-error',
              )}
            >
              {delta.label}
            </span>
          )}
        </div>
        {caption && (
          <span className={cn('text-[12px] font-medium', isDark ? 'text-white/60' : isLime ? 'text-forest-deep/70' : 'text-on-surface-variant')}>
            {caption}
          </span>
        )}
      </div>
      {/* Screen-reader action note AFTER the visible contents so the accessible
          name still starts with the visible label (WCAG 2.5.3). */}
      {actionLabel && onClick && <span className="sr-only"> {actionLabel}</span>}
    </Tag>
  );
}
