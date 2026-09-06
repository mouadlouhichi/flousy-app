'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { classifyInci, INCI_SCORE_MAX, type InciTier } from '@/lib/inci-quality';
import { useLanguage } from '@/lib/i18n-context';

type TierFilter = 'all' | InciTier;

const TIER_META: Record<InciTier, { icon: 'check' | 'warning'; text: string; dot: string }> = {
  concern: { icon: 'warning', text: 'text-error', dot: 'bg-error' },
  caution: { icon: 'warning', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  good: { icon: 'check', text: 'text-primary', dot: 'bg-primary' },
};

/**
 * Yuka-style cosmetic quality result for a scanned product: an overall score
 * dial, per-tier counts, and every INCI ingredient classified green/yellow/
 * orange with its common name and function tags.
 */
export function ProductQualityPanel({ ingredients }: { ingredients: string[] }) {
  const { messages: m, t, intlLocale } = useLanguage();
  const q = m.barcode.quality;
  const [filter, setFilter] = useState<TierFilter>('all');

  const result = classifyInci(ingredients);
  const numberFormat = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 });

  const visible =
    filter === 'all' ? result.ingredients : result.ingredients.filter((i) => i.tier === filter);

  // Chip order matches the result screenshots: All, then green → yellow → orange.
  const chips: Array<{ id: TierFilter; label: string; count: number; active: boolean }> = [
    { id: 'all', label: q.tiers.all, count: result.total, active: filter === 'all' },
    ...(['good', 'caution', 'concern'] as InciTier[]).map((tier) => ({
      id: tier as TierFilter,
      label: q.tiers[tier],
      count: result.counts[tier],
      active: filter === tier,
    })),
  ];

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
      {/* Header: title + score dial */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">
            <AppIcon name="science" className="text-[16px] text-primary" />
            {q.title}
          </span>
          <p className="mt-0.5 text-[11px] font-bold text-on-surface-variant">
            {t(q.ingredientsCount, { count: result.total })}
          </p>
        </div>
        <ScoreDial score={result.score} max={INCI_SCORE_MAX} counts={result.counts} />
      </div>

      {/* Tier filter chips */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => {
          const tierMeta = chip.id !== 'all' ? TIER_META[chip.id as InciTier] : null;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              aria-pressed={chip.active}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                chip.active
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              {tierMeta && <span className={`size-2 rounded-full ${chip.active ? 'bg-on-primary' : tierMeta.dot}`} />}
              {chip.label}
              <span className={chip.active ? 'opacity-80' : 'opacity-60'}>{numberFormat.format(chip.count)}</span>
            </button>
          );
        })}
      </div>

      {/* Ingredient list */}
      {visible.length === 0 ? (
        <p className="mt-2 text-xs text-on-surface-variant">{q.noneInTier}</p>
      ) : (
        <ul className="mt-1.5 max-h-64 divide-y divide-outline-variant/50 overflow-y-auto">
          {visible.map((ingredient) => {
            const meta = TIER_META[ingredient.tier];
            return (
              <li key={ingredient.inci} className="flex items-start gap-2.5 py-2">
                <AppIcon name={meta.icon} className={`mt-0.5 shrink-0 text-[16px] ${meta.text}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-on-surface">{ingredient.inci}</p>
                  {ingredient.common && (
                    <p className="text-[11px] italic text-on-surface-variant">
                      {(q.common as Record<string, string>)[ingredient.common]}
                    </p>
                  )}
                  {ingredient.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ingredient.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-surface-variant px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant"
                        >
                          {(q.tags as Record<string, string>)[tag]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-[10px] leading-relaxed text-on-surface-variant">
        {t(q.sourceNote, { max: INCI_SCORE_MAX })}
      </p>
    </div>
  );
}

/** Ring chart: arc segments sized by tier counts, score in the center. */
function ScoreDial({
  score,
  max,
  counts,
}: {
  score: number;
  max: number;
  counts: Record<InciTier, number>;
}) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(counts.concern + counts.caution + counts.good, 1);

  // Precompute each segment's running offset (arc start position).
  let consumed = 0;
  const segments = [
    { count: counts.good, color: 'var(--primary)' },
    { count: counts.caution, color: '#f59e0b' },
    { count: counts.concern, color: 'var(--error)' },
  ].map((segment) => {
    const start = consumed;
    consumed += segment.count;
    return { ...segment, start };
  });

  const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

  return (
    <div className="relative shrink-0" aria-label={`${numberFormat.format(score)} / ${max}`}>
      <svg viewBox="0 0 56 56" className="size-14">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="var(--surface-variant)" strokeWidth="5" />
        {segments.map(
          (segment, i) =>
            segment.count > 0 && (
              <circle
                key={i}
                cx="28"
                cy="28"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="5"
                strokeDasharray={`${(segment.count / total) * circumference} ${circumference}`}
                strokeDashoffset={-(segment.start / total) * circumference}
                transform="rotate(-90 28 28)"
              />
            ),
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-extrabold text-on-surface leading-none">
          {numberFormat.format(score)}
        </span>
        <span className="text-[9px] font-bold text-on-surface-variant leading-none">/{max}</span>
      </div>
    </div>
  );
}
