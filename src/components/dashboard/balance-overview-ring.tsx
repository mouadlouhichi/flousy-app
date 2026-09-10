'use client';

import { useId } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { MoneyFigure } from '@/components/ui/money-figure';
import { buildSparkPath, sparkPoint } from '@/components/charts/sparkline-path';
import { cn } from '@/lib/utils';

export interface RingView {
  id: string;
  /** AppIcon name for the action button. */
  icon: string;
  /** Visible caption under the figure and the button's accessible name. */
  label: string;
  amount: number;
  /** Optional second caption line (e.g. "of 10,000 MAD"). */
  note?: string;
  /** Normalised 0–1 series drawn as the sparkline; `null` = no history yet. */
  spark: number[] | null;
  /** Small chip pinned to the end of the sparkline, e.g. "+27%". */
  delta?: { label: string; positive: boolean; note?: string } | null;
  redacted?: boolean;
}

interface BalanceOverviewRingProps {
  views: RingView[];
  activeId: string;
  onChange: (id: string) => void;
  /** Accessible name of the action group. */
  actionsLabel: string;
  /** Mirror the action arc for right-to-left layouts. */
  rtl?: boolean;
  className?: string;
}

const SPARK_W = 160;
const SPARK_H = 56;
/** Decorative curve shown while a view has fewer than two months of history. */
const PLACEHOLDER_SPARK = [0.35, 0.42, 0.4, 0.55, 0.5, 0.68, 0.62, 0.8];
/** Angular distance between neighbouring action buttons on the bottom arc. */
const ARC_STEP_DEG = 28;

/**
 * The "Your Balance Overview" disc from the reference: a large white circle
 * with a soft shadow, a forest currency puck riding its top edge, a smooth
 * sparkline with a lime delta chip inside, the big figure underneath, and a
 * row of circular action buttons sitting on the bottom arc. Each action
 * switches which figure/series the disc shows — the active one is the forest
 * pill.
 */
export function BalanceOverviewRing({
  views,
  activeId,
  onChange,
  actionsLabel,
  rtl = false,
  className,
}: BalanceOverviewRingProps) {
  const gradId = useId();
  const active = views.find((v) => v.id === activeId) ?? views[0];
  if (!active) return null;

  const hasHistory = Boolean(active.spark && active.spark.length > 1);
  const series = hasHistory ? (active.spark as number[]) : PLACEHOLDER_SPARK;
  const path = buildSparkPath(series, SPARK_W, SPARK_H);
  const last = sparkPoint(series, series.length - 1, SPARK_W, SPARK_H);
  const lastLeft = `${((last.x / SPARK_W) * 100).toFixed(2)}%`;
  const lastTop = `${((last.y / SPARK_H) * 100).toFixed(2)}%`;

  const first = -((views.length - 1) * ARC_STEP_DEG) / 2;
  const dir = rtl ? -1 : 1;

  return (
    <div className={cn('relative mx-auto w-full max-w-[340px] pb-7 pt-5', className)}>
      <div className="relative aspect-square w-full">
        {/* Concentric hairlines around the disc */}
        <div aria-hidden className="pointer-events-none absolute -inset-[5%] rounded-full border border-sage/70" />
        <div aria-hidden className="pointer-events-none absolute -inset-[10%] rounded-full border border-sage/40" />

        {/* The disc */}
        <div className="absolute inset-0 rounded-full border border-transparent bg-surface-container-lowest shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_28px_56px_-24px_rgba(15,59,54,0.35),0_2px_6px_rgba(15,59,54,0.05)] dark:border-outline-variant dark:shadow-[0_28px_56px_-24px_rgba(0,0,0,0.8)]" />

        {/* Currency puck riding the top edge */}
        <span
          aria-hidden
          className="absolute left-1/2 top-0 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-forest text-lime shadow-[0_10px_22px_-8px_rgba(15,59,54,0.65)] ring-4 ring-surface dark:ring-background"
        >
          <AppIcon name="dollar" strokeWidth={2.4} className="text-[17px]" />
        </span>

        {/* Centre: sparkline + delta chip, then the figure */}
        <div className="absolute inset-[13%] flex flex-col items-center justify-center text-center">
          <div aria-hidden className="relative w-[64%]" style={{ aspectRatio: `${SPARK_W} / ${SPARK_H}` }}>
            <div className="dot-matrix absolute inset-x-3 inset-y-0 opacity-40 [mask-image:radial-gradient(closest-side,black,transparent)]" />
            <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <linearGradient id={`${gradId}-spark`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="var(--sage)" />
                  <stop offset="55%" stopColor="var(--lime-deep)" />
                  <stop offset="100%" stopColor="var(--forest)" />
                </linearGradient>
              </defs>
              <path
                key={active.id}
                d={path}
                fill="none"
                stroke={`url(#${gradId}-spark)`}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                className={cn('animate-draw-line', !hasHistory && 'opacity-50')}
              />
              <circle cx={last.x} cy={last.y} r={6} fill="var(--surface-container-lowest)" stroke="var(--forest)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
              <circle cx={last.x} cy={last.y} r={2.2} fill="var(--forest)" />
            </svg>
            {active.delta && (
              <span
                className={cn(
                  'absolute z-10 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tabular shadow-sm',
                  '-translate-x-[70%] -translate-y-[150%]',
                  active.delta.positive ? 'bg-lime text-forest-deep' : 'bg-error-container text-error',
                )}
                style={{ left: lastLeft, top: lastTop }}
              >
                {active.delta.label}
              </span>
            )}
          </div>

          <MoneyFigure
            value={active.amount}
            size="xl"
            weight="semibold"
            redacted={active.redacted}
            className="mt-3 max-w-full flex-wrap justify-center text-on-surface"
          />
          <span className="mt-1 text-[12.5px] font-medium text-on-surface-variant">{active.label}</span>
          {active.note && <span className="text-[11px] text-on-surface-variant/80">{active.note}</span>}
          {active.delta?.note && <span className="sr-only">{active.delta.note}</span>}
        </div>

        {/* Action buttons on the bottom arc */}
        {views.length > 1 && (
          <div role="group" aria-label={actionsLabel} className="absolute inset-0">
            {views.map((view, index) => {
              const theta = ((first + index * ARC_STEP_DEG) * Math.PI) / 180;
              const left = 50 + 50 * Math.sin(theta) * dir;
              const top = 50 + 50 * Math.cos(theta);
              const isActive = view.id === active.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => onChange(view.id)}
                  aria-pressed={isActive}
                  title={view.label}
                  className={cn(
                    'absolute flex h-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                    isActive
                      ? 'w-16 bg-forest text-lime shadow-[0_12px_24px_-10px_rgba(15,59,54,0.7)]'
                      : 'w-11 border border-outline-variant bg-surface-container-lowest text-forest shadow-ambient hover:-translate-y-[calc(50%+2px)] hover:bg-surface-container-low dark:text-lime',
                  )}
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <AppIcon name={view.icon} strokeWidth={2.2} className="text-[18px]" />
                  <span className="sr-only">{view.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
