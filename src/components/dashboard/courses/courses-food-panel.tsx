'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import type {
  AdditiveBand,
  AdditiveRole,
  AllergenGroup,
  FoodAnalysis,
  FoodFamily,
} from '@/lib/food-knowledge/types';
import { analyzeFoodKnowledge, splitFoodLabel } from '@/lib/food-analysis-client';

/**
 * Food-label knowledge panel (FOOD side of the label-knowledge feature).
 *
 * Shown in the pending-product card when a scanned/pasted label is a FOOD
 * ingredient list (the cosmetics side keeps CoursesIngredientPanel). The panel
 * explains the list — recognized families, EU major allergens, E-number
 * additives — with structured, localized chips and NO numeric score (see
 * docs/FEATURE_LABEL_KNOWLEDGE.md). Text comes from:
 *   1. the resolution cascade (Open Food Facts `ingredients_text`);
 *   2. a manual paste box (works without any barcode).
 * When the server is unreachable the same deterministic analysis runs locally.
 */

interface CoursesFoodPanelProps {
  /** Present when the product was identified by a barcode. */
  barcode?: string;
  /** Ingredient list supplied by the resolution cascade (OFF), if any. */
  initialText?: string;
  /** Product name used as a context hint. */
  name?: string;
  /** OFF-style category. */
  category?: string;
}

const FAMILY_KEY: Record<FoodFamily, string> = {
  dairy: 'familyDairy', egg: 'familyEgg', 'meat-fish': 'familyMeatFish',
  cereal: 'familyCereal', 'fruit-veg': 'familyFruitVeg', 'fat-oil': 'familyFatOil',
  sugar: 'familySugar', salt: 'familySalt', water: 'familyWater',
  culture: 'familyCulture', 'herb-spice': 'familyHerbSpice', 'nut-seed': 'familyNutSeed',
  legume: 'familyLegume', other: 'familyOther',
};

const ALLERGEN_KEY: Record<AllergenGroup, string> = {
  gluten: 'allergenGluten', crustaceans: 'allergenCrustaceans', eggs: 'allergenEggs',
  fish: 'allergenFish', peanuts: 'allergenPeanuts', soybeans: 'allergenSoybeans',
  milk: 'allergenMilk', nuts: 'allergenNuts', celery: 'allergenCelery',
  mustard: 'allergenMustard', sesame: 'allergenSesame', sulphites: 'allergenSulphites',
  lupin: 'allergenLupin', molluscs: 'allergenMolluscs',
};

const BAND_KEY: Record<AdditiveBand, string> = {
  neutral: 'additiveBandNeutral', watch: 'additiveBandWatch', avoid: 'additiveBandAvoid',
};

export function CoursesFoodPanel({
  initialText,
  name,
  category,
}: CoursesFoodPanelProps) {
  const { messages: m, t, language } = useLanguage();
  const g = m.foodKnowledge;
  const fromRecord = initialText?.trim() || '';

  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState<{
    status: 'idle' | 'loading' | 'ready';
    analysis?: FoodAnalysis;
    offline?: boolean;
  }>({ status: 'idle' });

  const run = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2 || splitFoodLabel(trimmed).length === 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setPending({ status: 'loading' });
    analyzeFoodKnowledge(
      { text: trimmed },
      {
        ...(name ? { label: name } : {}),
        ...(category ? { category } : {}),
        language,
      },
    )
      .then((result) => {
        setPending({
          status: 'ready',
          analysis: result.analysis,
          ...(result.offline ? { offline: true } : {}),
        });
      })
      .catch(() => setPending({ status: 'ready' }));
  };

  // Scanned records analyse themselves as soon as the text arrives.
  useEffect(() => {
    if (fromRecord) run(fromRecord);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromRecord]);

  const analysis = pending.status === 'ready' ? pending.analysis : undefined;

  return (
    <div className="mt-3 rounded-2xl border border-outline-variant bg-surface/70 p-3 md:p-3.5">
      <div className="flex items-center gap-2">
        <AppIcon name="menu_book" className="size-4 text-primary" />
        <p className="font-label-md text-label-md font-semibold text-on-surface">{g.title}</p>
      </div>

      {pending.status === 'loading' && (
        <p className="mt-3 flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <AppIcon name="hourglass_top" className="animate-spin size-4 text-primary" />
          {g.analyzing}
        </p>
      )}

      {fromRecord === '' && pending.status !== 'loading' && (
        <div className="mt-3">
          <p className="font-body-sm text-body-sm text-on-surface-variant">{g.pasteHelp}</p>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (invalid) setInvalid(false);
            }}
            rows={4}
            placeholder={g.pastePlaceholder}
            className="mt-2 w-full resize-y rounded-xl border border-outline-variant bg-surface p-3 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary"
          />
          {invalid && (
            <p className="mt-1 font-label-sm text-label-sm text-rose-600 dark:text-rose-400">
              {g.pasteInvalid}
            </p>
          )}
          <button
            type="button"
            onClick={() => run(draft)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary hover:opacity-90 transition-opacity"
          >
            <AppIcon name="search" className="size-4" />
            {g.analyzeCta}
          </button>
        </div>
      )}

      {analysis && <FoodKnowledgeBody analysis={analysis} />}
      {pending.status === 'ready' && !analysis && (
        <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">{g.unavailable}</p>
      )}

      <p className="mt-3 font-label-sm text-label-sm text-on-surface-variant/70">{g.disclaimer}</p>
    </div>
  );
}

/** Exported pure body — shared by the course panel and the standalone screen. */
export function FoodKnowledgeBody({ analysis }: { analysis: FoodAnalysis }) {
  const { messages: m, t } = useLanguage();
  const g = m.foodKnowledge;
  const { allergens, additives, ingredients } = analysis;
  const allergenGroups = allergens.length > 0 ? [...new Set(allergens.map((a) => a.group))] : [];
  const showAdditives = additives.length > 0;
  const watch = additives.filter((a) => a.band === 'watch');
  const avoid = additives.filter((a) => a.band === 'avoid');
  const childWarning = additives.some((a) => a.notices.includes('eu-children-warning'));
  const phe = additives.some((a) => a.notices.includes('phenylalanine'));

  const hasItems = analysis.total > 0;
  const nothingKnown = hasItems && analysis.recognized === 0;
  const allKnown = hasItems && analysis.coverage >= 1;
  const partial = hasItems && !allKnown && !nothingKnown;

  return (
    <div className="mt-3 space-y-3">
      {/* Coverage summary — informational status banner */}
      {hasItems && (
        <div
          className={
            'flex items-start gap-2.5 rounded-xl px-3 py-2 ' +
            (nothingKnown
              ? 'bg-surface-container-high/60'
              : allKnown
                ? 'bg-emerald-500/10'
                : 'bg-amber-500/10')
          }
        >
          <AppIcon
            name={nothingKnown ? 'search_off' : allKnown ? 'check_circle' : 'info'}
            className={
              'mt-0.5 size-4 shrink-0 ' +
              (nothingKnown
                ? 'text-on-surface-variant'
                : allKnown
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400')
            }
          />
          <div className="min-w-0">
            <p
              className={
                'font-label-md text-label-md font-semibold ' +
                (nothingKnown
                  ? 'text-on-surface-variant'
                  : allKnown
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400')
              }
            >
              {allKnown ? g.coverageAll : t(g.coverage, { recognized: analysis.recognized, total: analysis.total })}
            </p>
            {nothingKnown && (
              <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{g.unrecognizedAll}</p>
            )}
          </div>
        </div>
      )}

      {/* Allergens — informative, never a judgement */}
      {analysis.total > 0 && (
        <section className="rounded-xl border border-outline-variant bg-surface/50 p-3">
          <h4 className="flex items-center gap-1.5 font-label-sm text-label-sm font-semibold text-on-surface">
            <AppIcon name="warning" className="size-4 text-amber-600" />
            {g.allergensTitle}
          </h4>
          {allergenGroups.length === 0 ? (
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{g.allergenNone}</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {allergenGroups.map((group) => (
                  <span
                    key={group}
                    className="rounded-full bg-amber-500/10 px-2.5 py-1 font-label-sm text-label-sm font-medium text-amber-700 dark:text-amber-400"
                  >
                    {g[ALLERGEN_KEY[group] as keyof typeof g]}
                  </span>
                ))}
              </div>
              <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">{g.allergenNote}</p>
            </>
          )}
        </section>
      )}

      {/* Additives */}
      <section className="rounded-xl border border-outline-variant bg-surface/50 p-3">
        <h4 className="flex items-center gap-1.5 font-label-sm text-label-sm font-semibold text-on-surface">
          <AppIcon name="science" className="size-4 text-primary" />
          {g.additiveTitle}
        </h4>
        {!showAdditives ? (
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{g.additiveNone}</p>
        ) : (
          <>
            <ul className="mt-2 space-y-1.5">
              {additives.map((a, i) => (
                <li key={`${a.code}-${i}`} className="flex flex-wrap items-center gap-2">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface" dir="ltr">
                    {a.code}
                  </span>
                  <span
                    className={
                      'rounded-full px-2 py-0.5 font-label-sm text-label-sm ' +
                      (a.band === 'avoid'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : a.band === 'watch'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'bg-surface-container-high text-on-surface-variant')
                    }
                  >
                    {g[BAND_KEY[a.band] as keyof typeof g]}
                  </span>
                </li>
              ))}
            </ul>
            {avoid.length > 0 && (
              <p className="mt-2 font-label-sm text-label-sm text-rose-600 dark:text-rose-400">
                {g.additiveBannedNote}
              </p>
            )}
            {childWarning && (
              <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">
                {g.additiveChildrenNote}
              </p>
            )}
            {phe && (
              <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">
                {g.additivePhenylalanineNote}
              </p>
            )}
            {showAdditives && watch.length > 0 && !childWarning && !phe && avoid.length === 0 && (
              <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">{g.additiveEuRef}</p>
            )}
          </>
        )}
      </section>

      {/* Per-ingredient knowledge */}
      <section>
        <h4 className="font-label-sm text-label-sm font-semibold text-on-surface">{g.detailsTitle}</h4>
        <ul className="mt-1.5 divide-y divide-outline-variant/70 overflow-hidden rounded-xl border border-outline-variant bg-surface/50">
          {ingredients.map((item) => {
            const unknown = !item.recognized;
            return (
              <li key={item.index} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={'min-w-0 flex-1 truncate font-body-sm text-body-sm ' + (unknown ? 'text-on-surface-variant italic' : 'text-on-surface')}>
                    {item.raw}
                  </span>
                  {item.family && (
                    <Chip>{g[FAMILY_KEY[item.family] as keyof typeof g]}</Chip>
                  )}
                  {item.allergens.map((group) => (
                    <Chip key={group} tone="allergen">
                      {g[ALLERGEN_KEY[group] as keyof typeof g]}
                    </Chip>
                  ))}
                  {item.additive && (
                    <Chip tone="additive">
                      <span dir="ltr">{item.additive.code}</span>
                    </Chip>
                  )}
                  {/* When NOTHING on the list matched, a per-row 'not recognized' chip
                      would just repeat the banner above — keep the rows quiet. */}
                  {unknown && !nothingKnown && (
                    <Chip tone="unknown">{g.ingredientUnknown}</Chip>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {analysis.external.length > 0 && (
        <details className="rounded-xl border border-dashed border-outline-variant bg-surface/40 p-3">
          <summary className="cursor-pointer font-label-sm text-label-sm font-semibold text-primary">
            {g.externalTitle} ({analysis.external.length})
          </summary>
          <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">{g.externalIntro}</p>
          <ul className="mt-2 space-y-2">
            {analysis.external.map((entry, i) => (
              <li key={i} className="rounded-lg bg-surface/70 p-2.5">
                <p className="font-body-sm text-body-sm font-semibold text-on-surface">{entry.name}</p>
                <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{entry.summary}</p>
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                  <AppIcon name="public" className="size-3" />
                  {g.externalSourceTag}: {entry.source}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: 'allergen' | 'additive' | 'unknown' }) {
  const base = 'rounded-full px-2 py-0.5 font-label-sm text-label-sm ';
  if (tone === 'allergen') return <span className={base + 'bg-amber-500/10 text-amber-700 dark:text-amber-400'}>{children}</span>;
  if (tone === 'additive') return <span className={base + 'bg-primary/10 text-primary'}>{children}</span>;
  if (tone === 'unknown') return <span className={base + 'bg-surface-container-high text-on-surface-variant italic'}>{children}</span>;
  return <span className={base + 'bg-primary/10 text-primary'}>{children}</span>;
}

// Type-only re-export so callers can type panels without deep imports.
export type { AdditiveRole };
