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
}

type GlanceState =
  | { status: 'loading' }
  | { status: 'ready'; analysis: ProductAssessment }
  | { status: 'unavailable' };

const BAND_STYLE: Record<Band, { chip: string; text: string; ring: string }> = {
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

const BAND_LABEL_KEY: Record<Band, keyof GlanceMessages> = {
  excellent: 'bandExcellent',
  good: 'bandGood',
  moderate: 'bandModerate',
  caution: 'bandCaution',
  avoid: 'bandAvoid',
};

export function CoursesIngredientGlance({
  ingredientsText,
  label,
  category,
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
      className="mt-3 rounded-2xl border border-outline-variant bg-surface/70 p-3 md:p-3.5"
    >
      <div className="flex items-center gap-2">
        <AppIcon name="science" className="size-4 text-primary" />
        <p className="font-label-md text-label-md font-semibold text-on-surface">{g.title}</p>
      </div>

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

  const style = BAND_STYLE[a.band];
  const flagged = a.ingredients.filter((i) => i.tier && i.tier !== 'clean' && i.tier !== null);
  const recognizedLabel =
    a.recognized === a.total && a.total > 0
      ? t(g.recognizedAll, { total: a.total })
      : t(g.recognized, { recognized: a.recognized, total: a.total });

  return (
    <div className="mt-2.5 space-y-2.5">
      {/* Score chip + band */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-full font-headline-sm text-headline-sm font-bold tabular-nums ${style.chip}`}
        >
          {a.score}
        </span>
        <div className="min-w-0">
          <p className={`font-label-md text-label-md font-bold ${style.text}`}>
            {t(g[BAND_LABEL_KEY[a.band]])}
          </p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">{recognizedLabel}</p>
        </div>
      </div>

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

      {/* Expandable list of flagged ingredients */}
      {flagged.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 font-label-sm text-label-sm text-primary hover:opacity-80 transition-opacity"
            aria-expanded={showDetails}
          >
            <AppIcon name="expand_more" className={`size-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            {showDetails ? g.hideDetails : g.viewDetails}
          </button>
          {showDetails && (
            <ul className="divide-y divide-outline-variant/70 overflow-hidden rounded-xl border border-outline-variant bg-surface/60">
              {flagged.map((i) => (
                <li key={i.index} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate font-body-sm text-body-sm text-on-surface">
                    {i.matchedInci ?? i.raw}
                  </span>
                  <span className="shrink-0 font-label-sm text-label-sm text-on-surface-variant">
                    {t(g[TIER_LABEL_KEY[i.tier as RiskTier]])}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
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
