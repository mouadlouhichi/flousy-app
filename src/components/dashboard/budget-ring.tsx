'use client';

import { useId } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { MoneyFigure } from '@/components/ui/money-figure';
import { cn } from '@/lib/utils';

export interface BudgetRingSegment {
  id: string;
  label: string;
  /** Portion of the ring (any positive scale — normalised internally). */
  value: number;
  /** 0–1 share of this segment that has already been used. */
  usedRatio: number;
  /** Ring stroke colour (CSS colour). */
  color: string;
}

interface BudgetRingProps {
  /** Amount shown in the centre. */
  amount: number;
  amountLabel: string;
  segments: BudgetRingSegment[];
  /** Small trend badge under the centre chip, e.g. "+27%". */
  delta?: { label: string; positive: boolean } | null;
  /** Sparkline points (0–1 normalised). Drawn behind the amount. */
  spark?: number[];
  redacted?: boolean;
  className?: string;
}

const SIZE = 280;
const STROKE = 12;
const R = (SIZE - STROKE) / 2 - 8;
const C = 2 * Math.PI * R;

/**
 * The circular balance overview from the reference: concentric sage hairline
 * rings, a 12px segmented donut (one arc per envelope, muted where the
 * budget is still unspent), a soft sparkline in the centre and the big
 * figure underneath. Purely presentational — feed it any three segments.
 */
export function BudgetRing({
  amount,
  amountLabel,
  segments,
  delta,
  spark,
  redacted = false,
  className,
}: BudgetRingProps) {
  const gradId = useId();
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;
  const GAP = 0.018; // gap between arcs as a fraction of the circumference

  let cursor = 0;
  const arcs = segments.map((seg) => {
    const share = Math.max(0, seg.value) / total;
    const start = cursor;
    cursor += share;
    const visible = Math.max(0, share - GAP);
    const used = Math.min(1, Math.max(0, seg.usedRatio));
    return { seg, start, visible, used };
  });

  const sparkPath = spark && spark.length > 1 ? buildSparkPath(spark, 150, 46) : null;
  const lastPoint = spark && spark.length > 1 ? sparkPoint(spark, spark.length - 1, 150, 46) : null;

  return (
    <div className={cn('relative mx-auto flex w-full max-w-[320px] flex-col items-center', className)}>
      <div className="relative aspect-square w-full">
        {/* Concentric hairline rings */}
        <div aria-hidden className="rings-sage absolute inset-0 rounded-full opacity-90" />
        <div aria-hidden className="absolute inset-[9%] rounded-full bg-surface-container-lowest shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_20px_40px_-20px_rgba(15,59,54,0.25)]" />

        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full -rotate-90">
          <defs>
            <linearGradient id={`${gradId}-spark`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--sage)" />
              <stop offset="60%" stopColor="var(--lime-deep)" />
              <stop offset="100%" stopColor="var(--forest)" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--surface-variant)" strokeWidth={STROKE} />
          {arcs.map(({ seg, start, visible, used }) => {
            if (visible <= 0) return null;
            const offset = -start * C;
            const usedLen = visible * used * C;
            const restLen = visible * (1 - used) * C;
            return (
              <g key={seg.id}>
                {/* unspent portion — pale tint of the segment colour */}
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeOpacity={0.22}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${visible * C} ${C}`}
                  strokeDashoffset={offset}
                />
                {/* spent portion — solid */}
                {usedLen > 0 && (
                  <circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={R}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${usedLen} ${C}`}
                    strokeDashoffset={offset}
                    className="transition-[stroke-dasharray] duration-700 ease-out"
                  />
                )}
                {restLen < 0 && null}
              </g>
            );
          })}
        </svg>

        {/* Centre content */}
        <div className="absolute inset-[16%] flex flex-col items-center justify-center gap-1 text-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-forest text-lime shadow-[0_8px_18px_-8px_rgba(15,59,54,0.6)]">
            <AppIcon name="dollar" strokeWidth={2.4} className="text-[16px]" />
          </span>

          {sparkPath && (
            <div className="relative mt-1 h-[46px] w-[150px]">
              <div aria-hidden className="dot-matrix absolute inset-x-2 inset-y-0 opacity-50 [mask-image:radial-gradient(closest-side,black,transparent)]" />
              <svg viewBox="0 0 150 46" className="absolute inset-0 h-full w-full overflow-visible">
                <path
                  d={sparkPath}
                  fill="none"
                  stroke={`url(#${gradId}-spark)`}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  className="animate-draw-line"
                />
                {lastPoint && (
                  <>
                    <circle cx={lastPoint.x} cy={lastPoint.y} r={6} fill="var(--surface-container-lowest)" stroke="var(--forest)" strokeWidth={2.5} />
                    <circle cx={lastPoint.x} cy={lastPoint.y} r={2} fill="var(--forest)" />
                  </>
                )}
              </svg>
              {delta && (
                <span
                  className={cn(
                    'absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm',
                    delta.positive ? 'bg-forest text-lime' : 'bg-error-container text-error',
                  )}
                >
                  {delta.label}
                </span>
              )}
            </div>
          )}

          <MoneyFigure value={amount} size="xl" redacted={redacted} className="mt-2 text-on-surface" />
          <span className="text-[12px] font-medium text-on-surface-variant">{amountLabel}</span>
        </div>
      </div>
    </div>
  );
}

function sparkPoint(values: number[], i: number, w: number, h: number) {
  const x = (i / (values.length - 1)) * w;
  const y = h - Math.min(1, Math.max(0, values[i])) * (h - 8) - 4;
  return { x, y };
}

/** Smooth Catmull-Rom → Bézier path through normalised points. */
function buildSparkPath(values: number[], w: number, h: number): string {
  const pts = values.map((_, i) => sparkPoint(values, i, w, h));
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}
