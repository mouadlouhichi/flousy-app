'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import type { Messages } from '@/lib/i18n';
import { analyzeIngredientsText } from '@/lib/ingredient-analysis-client';
import type { Band, ProductAssessment, RiskTier } from '@/lib/ingredient-safety/types';

/**
 * Ingredient glance for a scanned cosmetic.
 *
 * Rendered inside the pending-product card when the resolved product carries a
 * full INCI list. Calls the self-hosted analysis route once per product
 * (cached in memory, deterministic) and shows: a score chip + band, the
 * recognition coverage, the most important concern flags, and an expandable
 * list of flagged ingredients. Everything shown is derived from the response
 * codes/structure and localized via message keys — server prose never leaks
 * into the UI.
 *
 * Informational only: the score is an EU-data-based index, not medical advice
 * (the disclaimer line is always rendered when content is shown).
 */

interface CoursesIngredientGlanceProps {
  ingredientsText: string;
  label?: string;
  category?: string;
  /**
   * Rendered inside the CoursesIngredientPanel card. When true the glance
   * drops its own border/title so the outer panel remains a single card with
   * one "Ingredients" header (avoids the double inner card duplicated title).
   */
  embedded?: boolean;
}

type GlanceState =
  | { status: 'loading' }
  | { status: 'ready'; analysis: ProductAssessment }
  | { status: 'unavailable' };

export const BAND_STYLE: Record<Band, { chip: string; text: string; ring: string }> = {
  excellent: {
    chip: 'bg-emerald-600 text-white',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'border-emerald-600/30',
  },
  good: {
    chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'border-emerald-500/30',
  },
  moderate: {
    chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    text: 'text-amber-700 dark:text-amber-400',
    ring: 'border-amber-500/30',
  },
  caution: {
    chip: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
    text: 'text-orange-700 dark:text-orange-400',
    ring: 'border-orange-500/30',
  },
  avoid: {
    chip: 'bg-rose-600 text-white',
    text: 'text-rose-700 dark:text-rose-400',
    ring: 'border-rose-500/40',
  },
};

type GlanceMessages = Messages['ingredientGlance'];

const TIER_LABEL_KEY: Record<RiskTier, keyof GlanceMessages> = {
  prohibited: 'bandProhibited',
  restricted: 'bandRestricted',
  caution: 'bandCaution',
  watch: 'bandWatch',
  clean: 'bandClean',
};

export const BAND_LABEL_KEY: Record<Band, keyof GlanceMessages> = {
  excellent: 'bandExcellent',
  good: 'bandGood',
  moderate: 'bandModerate',
  caution: 'bandCaution',
  avoid: 'bandAvoid',
};

/**
 * Coloured banner behind the overall rating. The colour follows the band
 * (teal for excellent → red for avoid); text sits on it, so each band keeps
 * a legible foreground.
 */
export const BANNER_STYLE: Record<Band, { bg: string }> = {
  excellent: { bg: 'bg-teal-600 text-white' },
  good: { bg: 'bg-emerald-600 text-white' },
  moderate: { bg: 'bg-amber-500 text-amber-950' },
  caution: { bg: 'bg-orange-600 text-white' },
  avoid: { bg: 'bg-rose-600 text-white' },
};

/** Five-star row; filled count = round(score/100 × 5). Decorative. */
function StarRow({ score, className }: { score: number; className?: string }) {
  const filled = Math.max(0, Math.min(5, Math.round((score / 100) * 5)));
  return (
    <span className={`flex items-center gap-0.5 ${className ?? ''}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="size-3.5 shrink-0"
          fill={i < filled ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

/** Colored tier pill used on ingredient rows inside the details list. */
const TIER_STYLE: Record<RiskTier, string> = {
  prohibited: 'bg-rose-600 text-white',
  restricted: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  caution: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  watch: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  clean: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
};

/** Small round dot mirroring the row tier (kept visible at a glance). */
const TIER_DOT: Record<RiskTier, string> = {
  prohibited: 'bg-rose-600',
  restricted: 'bg-rose-500',
  caution: 'bg-orange-500',
  watch: 'bg-amber-500',
  clean: 'bg-emerald-500',
};

export function CoursesIngredientGlance({
  ingredientsText,
  label,
  category,
  embedded = false,
}: CoursesIngredientGlanceProps) {
  const { messages } = useLanguage();
  const g = messages.ingredientGlance;
  const [state, setState] = useState<GlanceState>({ status: 'loading' });

  const text = ingredientsText.trim();
  useEffect(() => {
    if (!text) return;
    const controller = new AbortController();
    let cancelled = false;
    setState({ status: 'loading' });
    analyzeIngredientsText(text, { label, category, signal: controller.signal })
      .then((analysis) => {
        if (!cancelled) setState({ status: 'ready', analysis });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable' });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [text, label, category]);

  if (!text) return null;
  const loading = state.status === 'loading';

  return (
    <div
      aria-live="polite"
      className={embedded ? '' : 'mt-3 rounded-2xl border border-outline-variant bg-surface/70 p-3 md:p-3.5'}
    >
      {!embedded && (
        <div className="flex items-center gap-2">
          <AppIcon name="science" className="size-4 text-primary" />
          <p className="font-label-md text-label-md font-semibold text-on-surface">{g.title}</p>
        </div>
      )}

      {loading && (
        <p className="mt-2 flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <AppIcon name="hourglass_top" className="animate-spin size-3.5" />
          {g.analyzing}
        </p>
      )}

      {state.status === 'unavailable' && (
        <p className="mt-2 flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <AppIcon name="info" className="size-3.5" />
          {g.unavailable}
        </p>
      )}

      {state.status === 'ready' && <CoursesIngredientGlanceBody analysis={state.analysis} />}
    </div>
  );
}

/**
 * Presentational body of the glance (exported for server-render tests): score
 * chip + translated band, coverage line, flag lines and the expandable
 * per-ingredient tier list. Never renders while the wrapper is still fetching.
 */
export function CoursesIngredientGlanceBody({ analysis }: { analysis: ProductAssessment }) {
  const { messages, t } = useLanguage();
  const g = messages.ingredientGlance;
  const [showDetails, setShowDetails] = useState(false);
  const a = analysis;

  if (a.score === null || a.band === null) {
    return (
      <div>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">{g.scoreUnknown}</p>
        <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant/70">
          {g.disclaimer}
        </p>
      </div>
    );
  }

  const flagged = a.ingredients.filter(
    (i) => i.tier && i.tier !== 'clean' && i.tier !== null,
  );
  const prohibitedOrRestricted = flagged.some(
    (i) => i.tier === 'prohibited' || i.tier === 'restricted',
  );
  const unknownCount = a.total - a.recognized;
  const recognizedLabel =
    a.recognized === a.total && a.total > 0
      ? t(g.recognizedAll, { total: a.total })
      : t(g.recognized, { recognized: a.recognized, total: a.total });

  // Three-colour tier proportions for the strip under the score
  // (clean → green, watch/restricted → yellow, caution/prohibited → orange).
  let tierGood = 0;
  let tierCaution = 0;
  let tierConcern = 0;
  for (const ingredient of a.ingredients) {
    if (ingredient.tier === 'clean') tierGood += 1;
    else if (ingredient.tier === 'watch' || ingredient.tier === 'restricted') tierCaution += 1;
    else if (ingredient.tier === 'caution' || ingredient.tier === 'prohibited') tierConcern += 1;
  }
  const tierTotal = tierGood + tierCaution + tierConcern;

  return (
    <div className="mt-2.5 space-y-2.5">
      {/* Overall quality rating — the prominent banner: big score + /100,
          rating label, five-star row on a band-coloured background, with a
          thin strip under the score keeping the green/yellow/orange tier
          proportions the old dial showed. */}
      <div
        className={`rounded-2xl p-3.5 md:p-4 ${BANNER_STYLE[a.band].bg}`}
        role="img"
        aria-label={`${a.score}/100 — ${t(g[BAND_LABEL_KEY[a.band]])}`}
      >
        <div className="flex items-center gap-3.5">
          <div className="shrink-0">
            <p className="flex items-baseline font-headline-lg text-headline-lg font-bold leading-none tabular-nums" dir="ltr">
              {a.score}
              <span className="ms-0.5 font-label-md text-label-md font-semibold opacity-70">/100</span>
            </p>
            {tierTotal > 0 && (
              <div className="mt-2 flex h-1 w-16 overflow-hidden rounded-full bg-white/25" aria-hidden="true">
                <span className="bg-green-400" style={{ width: `${(tierGood / tierTotal) * 100}%` }} />
                <span className="bg-yellow-400" style={{ width: `${(tierCaution / tierTotal) * 100}%` }} />
                <span className="bg-orange-400" style={{ width: `${(tierConcern / tierTotal) * 100}%` }} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-label-lg text-label-lg font-bold">{t(g[BAND_LABEL_KEY[a.band]])}</p>
            <StarRow score={a.score} className="mt-0.5 opacity-90" />
            <p className="mt-1 flex items-center gap-1.5 font-label-sm text-label-sm opacity-75">
              <AppIcon name="task_alt" className="size-3.5 shrink-0" />
              <span className="truncate">{recognizedLabel}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Takeaway chips — color-coded counts; the flagged pill toggles the list */}
      {(flagged.length > 0 || unknownCount > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {flagged.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              aria-pressed={showDetails}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-label-sm text-label-sm font-medium transition-colors ${
                prohibitedOrRestricted
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 hover:bg-rose-500/25'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25'
              }`}
            >
              <AppIcon
                name={prohibitedOrRestricted ? 'error' : 'warning'}
                className="size-3.5 shrink-0"
              />
              {t(g.chipFlagged, { count: flagged.length })}
              <AppIcon
                name="expand_more"
                className={`size-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`}
              />
            </button>
          )}
          {unknownCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant">
              <AppIcon name="info" className="size-3.5 shrink-0" />
              {t(g.chipUnknown, { count: unknownCount })}
            </span>
          )}
          {flagged.length > 0 && !showDetails && (
            <span className="inline-flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant/80">
              <AppIcon name="chevron_right" className="size-3.5" />
              {g.viewDetails}
            </span>
          )}
        </div>
      )}

      {flagged.length === 0 && unknownCount === 0 && (
        <p className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface">
          <AppIcon
            name="check_circle"
            className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          />
          {g.chipNoConcern}
        </p>
      )}

      {/* Concern flags (composed locally from response codes) */}
      {a.flags.length > 0 && (
        <ul className="space-y-1.5">
          {a.flags.slice(0, 3).map((flag) => {
            const flagLabel = ingredientFlagText(flag.code, a, g, t);
            if (!flagLabel) return null;
            return (
              <li key={flag.code} className="flex items-start gap-1.5">
                <AppIcon
                  name={flag.level === 'error' ? 'error' : flag.level === 'warn' ? 'warning' : 'info'}
                  className={`mt-0.5 size-3.5 shrink-0 ${
                    flag.level === 'error'
                      ? 'text-rose-600 dark:text-rose-400'
                      : flag.level === 'warn'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-on-surface-variant'
                  }`}
                />
                <span className="font-body-sm text-body-sm text-on-surface">{flagLabel}</span>
              </li>
            );
          })}
          {a.flags.length > 3 && (
            <li className="ps-5 font-label-sm text-label-sm text-on-surface-variant">
              {t(g.moreFlags, { count: a.flags.length - 3 })}
            </li>
          )}
        </ul>
      )}

      {/* Expandable list of flagged ingredients — colored tier pills */}
      {flagged.length > 0 && showDetails && (
        <ul className="divide-y divide-outline-variant/70 overflow-hidden rounded-xl border border-outline-variant bg-surface/60">
          {flagged.map((i) => {
            const tier = i.tier as RiskTier;
            return (
              <li key={i.index} className="flex items-center gap-2.5 px-3 py-2">
                <span className={`size-2 shrink-0 rounded-full ${TIER_DOT[tier]}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-body-sm text-body-sm text-on-surface">
                  {i.matchedInci ?? i.raw}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-label-sm text-label-sm ${TIER_STYLE[tier]}`}
                >
                  {t(g[TIER_LABEL_KEY[tier]])}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="font-label-sm text-label-sm text-on-surface-variant/70">{g.disclaimer}</p>
    </div>
  );
}

/** Localized, structured one-liner per flag code (names come from the JSON,
 *  which only ever carries INCI names — language-neutral enough for any UI).
 *  Exported pure so the copy can be unit-tested against the real engine
 *  output without a DOM. */
export function ingredientFlagText(
  code: string,
  a: ProductAssessment,
  g: GlanceMessages,
  t: (template: string, values?: Record<string, string | number>) => string,
): string {
  const names = (getter: (i: (typeof a.ingredients)[number]) => boolean) =>
    a.ingredients.filter(getter).map((i) => i.matchedInci ?? i.raw);

  switch (code) {
    case 'contains-prohibited': {
      const list = names((i) => i.tier === 'prohibited');
      return list.length <= 1
        ? t(g.flagProhibitedOne, { name: list[0] ?? '' })
        : t(g.flagProhibitedOther, { names: list.join(', ') });
    }
    case 'fragrance-allergens': {
      const list = names((i) => i.signals.some((s) => s.code === 'eu-fragrance-allergen'));
      return t(g.flagAllergens, { count: list.length, names: list.slice(0, 3).join(', ') });
    }
    case 'eu-restricted-ingredients': {
      const list = names((i) => i.tier === 'restricted');
      return t(g.flagRestricted, { names: list.join(', ') });
    }
    case 'fragrance-generic':
      return g.flagGeneric;
    case 'formaldehyde-releasers': {
      const list = names((i) => i.signals.some((s) => s.code === 'formaldehyde-releaser'));
      return t(g.flagReleasers, { names: list.join(', ') });
    }
    case 'unknown-ingredients': {
      const count = a.total - a.recognized;
      return t(g.flagUnknown, { count });
    }
    default:
      return '';
  }
}
