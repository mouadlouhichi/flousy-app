'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import type { Messages } from '@/lib/i18n';
import { analyzeIngredientsText } from '@/lib/ingredient-analysis-client';
import type { Band, ProductAssessment, ProductForm, RiskTier } from '@/lib/ingredient-safety/types';

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
  form?: ProductForm;
  source?: ProductAssessment['parser']['source'];
  reviewed?: boolean;
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

/** Colored tier pill used on ingredient rows inside the details list. */
const TIER_STYLE: Record<RiskTier, string> = {
  prohibited: 'bg-rose-600 text-white',
  restricted: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  caution: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  watch: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  clean: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
};

/** One ranked row of the "main risk drivers" breakdown: the ingredient label
 * name plus the points its assessment removed from the 100-point index. */
export interface RiskDriver {
  index: number;
  name: string;
  tier: RiskTier;
  deduction: number;
}

/**
 * Rank the ingredients that actually moved the evidence index, strongest
 * contribution first. Pure and exported so the ranking contract is testable
 * without a DOM. Only assessed rows with a positive deduction qualify; label
 * order breaks ties so the output is deterministic.
 */
export function riskDrivers(
  analysis: Pick<ProductAssessment, 'ingredients' | 'score'>,
  max = 3,
): RiskDriver[] {
  if (analysis.score === null) return [];
  return analysis.ingredients
    .filter((i) => i.tier !== null && (i.deduction ?? 0) > 0)
    .sort((a, b) => (b.deduction ?? 0) - (a.deduction ?? 0) || a.index - b.index)
    .slice(0, max)
    .map((i) => ({
      index: i.index,
      name: i.matchedInci ?? i.raw,
      tier: i.tier as RiskTier,
      deduction: i.deduction ?? 0,
    }));
}

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
  form,
  source,
  reviewed,
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
    analyzeIngredientsText(text, { label, category, form, source, reviewed, signal: controller.signal })
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
  }, [text, label, category, form, source, reviewed]);

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

  const scored = a.score !== null && a.band !== null
    ? { score: a.score, band: a.band }
    : null;

  const flagged = a.ingredients.filter(
    (i) => i.tier && i.tier !== 'clean' && i.tier !== null,
  );
  const prohibitedOrRestricted = flagged.some(
    (i) => i.tier === 'prohibited' || i.tier === 'restricted',
  );
  const unknownCount = a.total - a.recognized;
  const unassessedCount = a.ingredients.filter((item) => item.assessmentState === 'identified-no-assessment' || item.assessmentState === 'externally-identified').length;
  const drivers = riskDrivers(a);
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
      {scored ? (
        <div
          className={`rounded-2xl p-3.5 md:p-4 ${BANNER_STYLE[scored.band].bg}`}
          role="img"
          aria-label={`${g.evidenceIndex}: ${100 - scored.score}/100`}
        >
          <div className="flex items-center gap-3.5">
            <div className="shrink-0">
              <p className="font-label-sm text-label-sm font-semibold opacity-80">{g.evidenceIndex}</p>
              <p className="flex items-baseline font-headline-lg text-headline-lg font-bold leading-none tabular-nums" dir="ltr">
                {100 - scored.score}
                <span className="ms-0.5 font-label-md text-label-md font-semibold opacity-70">/100</span>
              </p>
              <p className="mt-0.5 font-label-sm text-label-sm font-semibold opacity-70" dir="ltr">
                {g.riskScale}
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
              <p className="font-label-md text-label-md font-semibold">{g.indexNotSafetyVerdict}</p>
              <p className="mt-1 flex items-center gap-1.5 font-label-sm text-label-sm opacity-80">
                <AppIcon name="database" className="size-3.5 shrink-0" />
                <span className="truncate">{recognizedLabel}</span>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-outline-variant bg-surface-container-high/60 px-3 py-2">
          <p className="font-body-sm text-body-sm font-medium text-on-surface">{g.scoreUnknown}</p>
          <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">{g.indexNotSafetyVerdict}</p>
        </div>
      )}

      {/* Ranked risk drivers — the ingredients that actually moved the index,
          strongest contribution first. Only meaningful when a score exists. */}
      {scored && drivers.length > 0 && (
        <div className={`rounded-xl border px-3 py-2.5 ${BAND_STYLE[scored.band].ring}`}>
          <p className="font-label-sm text-label-sm font-semibold text-on-surface-variant">
            {g.riskDriversTitle}
          </p>
          <ul className="mt-1.5 space-y-1">
            {drivers.map((driver) => (
              <li key={driver.index} className="flex items-center gap-2">
                <span className={`size-2 shrink-0 rounded-full ${TIER_DOT[driver.tier]}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-body-sm text-body-sm text-on-surface">
                  {driver.name}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-label-sm text-label-sm ${TIER_STYLE[driver.tier]}`}>
                  {t(g[TIER_LABEL_KEY[driver.tier]])}
                </span>
                <span
                  className="shrink-0 font-label-sm text-label-sm font-semibold tabular-nums text-on-surface-variant"
                  dir="ltr"
                >
                  {t(g.driverPoints, { points: driver.deduction })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Takeaway chips — color-coded counts; the flagged pill toggles the list */}
      {(flagged.length > 0 || unknownCount > 0 || unassessedCount > 0) && (
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
          {unassessedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant">
              <AppIcon name="help" className="size-3.5 shrink-0" />
              {t(g.chipUnassessed, { count: unassessedCount })}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant"
          >
            <AppIcon name="list" className="size-3.5" />
            {showDetails ? g.hideDetails : g.reviewIngredients}
          </button>
        </div>
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

      {showDetails && (
        <ul className="divide-y divide-outline-variant/70 overflow-hidden rounded-xl border border-outline-variant bg-surface/60">
          {a.ingredients.map((ingredient) => {
            const tier = ingredient.tier;
            const identityLabel = ingredient.identity.status === 'unidentified'
              ? g.identityUnknown
              : ingredient.identity.status === 'externally-identified'
                ? g.identityExternal
                : ingredient.assessmentState === 'identified-no-assessment'
                  ? g.identityOnly
                  : g.identityAssessed;
            return (
              <li key={ingredient.index} className="flex items-center gap-2.5 px-3 py-2">
                <span className={`size-2 shrink-0 rounded-full ${tier ? TIER_DOT[tier] : 'bg-outline'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body-sm text-body-sm text-on-surface">
                    {ingredient.matchedInci ?? ingredient.raw}
                  </span>
                  {ingredient.matchedInci && ingredient.matchedInci !== ingredient.raw && (
                    <span className="block truncate font-label-sm text-label-sm text-on-surface-variant">{ingredient.raw}</span>
                  )}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-label-sm text-label-sm ${tier ? TIER_STYLE[tier] : 'bg-surface-container-high text-on-surface-variant'}`}>
                  {tier ? t(g[TIER_LABEL_KEY[tier]]) : identityLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="font-label-sm text-label-sm text-on-surface-variant">
        {t(g.assessmentMeta, {
          date: a.dataset.regulationAsOf ?? a.dataset.snapshot,
          form: a.form === 'leave-on' ? g.formLeaveOn : a.form === 'rinse-off' ? g.formRinseOff : g.formUnknown,
        })}
      </p>
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
    case 'fragrance-allergens':
    case 'fragrance-allergen-name-matches': {
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
    case 'eu-annex-ii-name-match': {
      const list = names((i) => i.signals.some((s) => s.regulatory?.annex === 'II'));
      return t(g.flagAnnexII, { names: list.join(', ') });
    }
    case 'regulatory-conditions-unknown':
      return g.flagConditionsUnknown;
    case 'parser-review-required':
      return g.flagParserReview;
    case 'ocr-review-required':
      return g.flagOcrReview;
    case 'withheld-no-ingredients':
    case 'withheld-invalid-parse':
    case 'withheld-review-required':
    case 'withheld-form-unknown':
    case 'withheld-conditions-unknown':
    case 'withheld-insufficient-evidence':
      return g.flagScoreWithheld;
    default:
      return '';
  }
}
