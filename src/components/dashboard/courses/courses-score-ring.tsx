'use client';

/**
 * Yuka-style score ring: a circular gauge whose coloured arc shows the
 * product rank (score / 100) with the number in the middle.
 *
 * The arc fraction is derived from the SAME 0–100 score the analysis engine
 * returns (see src/lib/ingredient-safety/analyze.ts), and the stroke colour
 * from the band the engine derives from that score — so the ring always
 * matches the glance rendered inside the panel and can never disagree with
 * the number it draws.
 */

import type { Band } from '@/lib/ingredient-safety/types';

export const RING_SIZE = 40;
export const RING_STROKE = 4.5;

/** Fill-only track shown while the score is unknown. */
export const RING_UNKNOWN_COLOR = '#94a3b8'; // slate-400

/** Saturated ring colour per band (readable on light & dark surfaces). */
export const RING_BAND_COLOR: Record<Band, string> = {
  excellent: '#059669', // emerald-600
  good: '#10b981', // emerald-500
  moderate: '#f59e0b', // amber-500
  caution: '#f97316', // orange-500
  avoid: '#e11d48', // rose-600
};

/**
 * Clamp an engine score to the 0–100 ring fraction. Non-finite or out-of-range
 * values (shouldn't happen — the engine rounds to an int) never draw an arc
 * longer than the track.
 */
export function scoreFraction(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score)) / 100;
}

interface ScoreRingProps {
  /** Engine score (0–100). Required unless `unknown`. */
  score?: number;
  /** Engine band — drives the arc colour. Required unless `unknown`. */
  band?: Band;
  /** Accessible name (localized), e.g. "87 / 100 — good". */
  label: string;
  /** Tailwind text class for the centred number (dark-mode aware). */
  toneClass: string;
  /** Px diameter (default 40). */
  size?: number;
  /** Score could not be computed (no recognized ingredients) — grey full ring. */
  unknown?: boolean;
}

export function ScoreRing({
  score,
  band,
  label,
  toneClass,
  size = RING_SIZE,
  unknown = false,
}: ScoreRingProps) {
  const stroke = RING_STROKE;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = unknown ? 1 : scoreFraction(score ?? 0);
  const center = size / 2;
  const color = unknown ? RING_UNKNOWN_COLOR : band ? RING_BAND_COLOR[band] : RING_UNKNOWN_COLOR;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-on-surface-variant/25"
        />
        {/* Score arc — the same number, same band as the glance */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap={unknown ? undefined : 'round'}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - fraction)}
          style={unknown ? { opacity: 0.55 } : undefined}
        />
      </svg>
      <span
        className={`absolute text-[12px] font-bold tabular-nums leading-none ${toneClass}`}
        dir="ltr"
      >
        {unknown ? '–' : score}
      </span>
    </span>
  );
}
