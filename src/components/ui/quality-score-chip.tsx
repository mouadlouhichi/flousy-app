'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n-context';
import type { SessionItemQuality } from '@/lib/store';
import { BAND_STYLE } from '@/components/dashboard/courses/courses-ingredient-glance';

/**
 * Compact quality score chip for course lines (`87/100`, coloured by band).
 * Clicking it opens a popover with the rating label and the green/yellow/
 * orange tier breakdown. Rendered after the item name in the pending card,
 * the active-session list and the bill — only lines that carry a
 * `SessionItemQuality` (cosmetics with an INCI list) show one.
 */

/** Tier-dot colours for the popover breakdown (green / yellow / orange). */
const TIER_ROW_COLORS = ['#10b981', '#f59e0b', '#f97316'] as const;

/** Chip dot colour per band (green for excellent/good, …, orange for avoid). */
const CHIP_DOT_COLOR: Record<NonNullable<SessionItemQuality['band']>, string> = {
  excellent: TIER_ROW_COLORS[0],
  good: TIER_ROW_COLORS[0],
  moderate: TIER_ROW_COLORS[1],
  caution: TIER_ROW_COLORS[2],
  avoid: TIER_ROW_COLORS[2],
};

export function QualityScoreChip({
  quality,
  className,
}: {
  quality: SessionItemQuality;
  className?: string;
}) {
  const { messages: m } = useLanguage();
  const g = m.ingredientGlance;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  // Close on outside press / Escape (the popover floats over the row).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (quality.score === null || quality.band === null) return null;
  const style = BAND_STYLE[quality.band];
  const chipLabel = `${g.evidenceIndex} — ${quality.score}/100`;

  return (
    <span ref={rootRef} className={`relative inline-flex shrink-0 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={chipLabel}
        title={chipLabel}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-label-sm text-label-sm font-bold tabular-nums transition-colors ${style.ring} ${style.text} hover:bg-surface-variant/50`}
        dir="ltr"
      >
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: CHIP_DOT_COLOR[quality.band] }}
          aria-hidden="true"
        />
        {quality.score}/100
      </button>

      {open && <QualityScorePopover quality={quality} chipLabel={chipLabel} />}
    </span>
  );
}

/**
 * The chip's popover content, exported as a presentational component so SSR
 * render tests can exercise it directly (same pattern as the glance body).
 */
export function QualityScorePopover({
  quality,
  chipLabel,
}: {
  quality: SessionItemQuality;
  chipLabel: string;
}) {
  const { messages: m } = useLanguage();
  const g = m.ingredientGlance;
  if (quality.score === null || quality.band === null) return null;
  const style = BAND_STYLE[quality.band];
  const tierRows = quality.tiers
    ? [
        [g.bandProhibited, quality.tiers.prohibited, '#e11d48'],
        [g.bandRestricted, quality.tiers.restricted, '#f43f5e'],
        [g.bandCaution, quality.tiers.caution, '#f97316'],
        [g.bandWatch, quality.tiers.watch, '#f59e0b'],
        [g.bandClean, quality.tiers.clean, '#10b981'],
        [g.identityOnly, quality.tiers.unassessed, '#94a3b8'],
      ] as const
    : [
        [g.bandClean, quality.good ?? 0, TIER_ROW_COLORS[0]],
        [g.bandWatch, quality.caution ?? 0, TIER_ROW_COLORS[1]],
        [g.bandCaution, quality.concern ?? 0, TIER_ROW_COLORS[2]],
      ] as const;
  return (
    <span
      role="dialog"
      aria-label={chipLabel}
      className="absolute top-full z-30 mt-1.5 block w-52 rounded-xl border border-outline-variant bg-surface-container-high p-3 shadow-xl"
    >
      <span className={`block font-label-md text-label-md font-bold ${style.text}`}>{g.evidenceIndex}</span>
      <span className="mt-0.5 block font-label-sm text-label-sm text-on-surface-variant" dir="ltr">
        {quality.score}/100
      </span>
      <span className="mt-2 flex flex-col gap-1">
        {tierRows.map(([tierLabel, count, color], i) => (
          <span key={i} className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface">
            <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{tierLabel}</span>
            <span className="font-bold tabular-nums" dir="ltr">
              {count}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
