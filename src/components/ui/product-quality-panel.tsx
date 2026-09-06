'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { loadCosingIndex, type CosingIndex } from '@/lib/cosing';
import { classifyInci, INCI_SCORE_MAX, type InciTier } from '@/lib/inci-quality';
import { useLanguage } from '@/lib/i18n-context';

type TierFilter = 'all' | InciTier;

const TIER_META: Record<InciTier, { icon: 'check' | 'warning'; text: string; dot: string }> = {
  concern: { icon: 'warning', text: 'text-error', dot: 'bg-error' },
  caution: { icon: 'warning', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  good: { icon: 'check', text: 'text-primary', dot: 'bg-primary' },
};

/**
 * Yuka-style cosmetic quality result: an overall score dial, per-tier counts,
 * and every INCI ingredient classified green/yellow/orange with its common
 * name and function tags. `source` picks the data attribution line.
 */
export function ProductQualityPanel({
  ingredients,
  source = 'openbeauty',
  productName,
  productBrand,
  productImage,
}: {
  ingredients: string[];
  source?: 'openbeauty' | 'photo';
  /** Product identity, when the barcode resolved a known product. */
  productName?: string;
  productBrand?: string;
  productImage?: string;
}) {
  const { messages: m, t, intlLocale } = useLanguage();
  const q = m.barcode.quality;
  const [filter, setFilter] = useState<TierFilter>('all');
  // EU CosIng regulatory index (functions + Annex flags) — loaded lazily;
  // classification falls back to the curated rules until it arrives (or
  // if it fails).
  const [cosing, setCosing] = useState<CosingIndex | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCosingIndex().then((index) => {
      if (alive) setCosing(index);
    });
    return () => {
      alive = false;
    };
  }, []);

  const result = classifyInci(ingredients, cosing);
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
      {/* Product identity, when the scan resolved a known product */}
      {(productName || productBrand || productImage) && (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-surface-container p-2">
          {productImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productImage} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-variant text-primary">
              <AppIcon name="face_2" className="text-[20px]" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-on-surface">
              {productBrand && productName ? `${productBrand} ${productName}` : (productName || productBrand)}
            </p>
            {productBrand && productName && (
              <p className="truncate text-[11px] font-semibold text-on-surface-variant">{productName}</p>
            )}
          </div>
        </div>
      )}
      {/* Header */}
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
      </div>

      {/* Yuka/INCI-Beauty-style overall quality rating */}
      <RatingBanner
        score={result.score}
        max={INCI_SCORE_MAX}
        counts={result.counts}
        ratings={q.ratings}
      />

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
        {t(source === 'photo' ? q.sourceNotePhoto : q.sourceNote, { max: INCI_SCORE_MAX })}
      </p>
      {cosing && (
        <p className="mt-1 text-[10px] leading-relaxed text-on-surface-variant/80">{q.cosingNote}</p>
      )}
    </div>
  );
}

/** Score → quality band, as a ratio of the maximum (Yuka-style thresholds). */
const RATING_BANDS = [
  { min: 0.8, key: 'excellent', color: '#00897b' },
  { min: 0.6, key: 'good', color: '#43a047' },
  { min: 0.4, key: 'fair', color: '#e6950b' },
  { min: 0, key: 'poor', color: '#ba1a1a' },
] as const;

type RatingKey = (typeof RATING_BANDS)[number]['key'];

function ratingBand(score: number, max: number): (typeof RATING_BANDS)[number] {
  const ratio = max > 0 ? score / max : 0;
  return RATING_BANDS.find((band) => ratio >= band.min) ?? RATING_BANDS[RATING_BANDS.length - 1];
}

/**
 * The overall quality rating, as shown by Yuka / INCI Beauty: a colored
 * banner with the big score, a quality label, stars, and a thin strip of
 * the green/yellow/orange tier proportions.
 */
function RatingBanner({
  score,
  max,
  counts,
  ratings,
}: {
  score: number;
  max: number;
  counts: Record<InciTier, number>;
  ratings: Record<RatingKey, string>;
}) {
  const band = ratingBand(score, max);
  const total = Math.max(counts.concern + counts.caution + counts.good, 1);
  const stars = Math.round((score / max) * 5);
  const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

  return (
    <div
      className="mt-2 rounded-xl p-4 text-white"
      style={{ backgroundColor: band.color }}
      role="img"
      aria-label={`${ratings[band.key]} — ${numberFormat.format(score)} / ${max}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-black leading-none">{numberFormat.format(score)}</span>
          <span className="text-lg font-bold opacity-80">/{max}</span>
        </div>
        <div className="text-right">
          <p className="text-base font-extrabold uppercase tracking-wide">{ratings[band.key]}</p>
          <div className="mt-1 flex justify-end gap-0.5" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < stars ? 'text-white' : 'text-white/40'}>
                ★
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Tier proportions (green → yellow → orange), as white opacity steps */}
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/25">
        <div style={{ width: `${(counts.good / total) * 100}%` }} className="bg-white" />
        <div style={{ width: `${(counts.caution / total) * 100}%` }} className="bg-white/70" />
        <div style={{ width: `${(counts.concern / total) * 100}%` }} className="bg-white/40" />
      </div>
    </div>
  );
}
