'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import type {
  AdditiveBand,
  AdditiveRole,
  AllergenGroup,
  FoodAnalysis,
  FoodConcernCode,
  FoodFamily,
} from '@/lib/food-knowledge/types';
import { analyzeFoodKnowledge, splitFoodLabel } from '@/lib/food-analysis-client';
import { detectFoodKind } from '@/lib/food-knowledge/domain';
import { foldForMatch } from '@/lib/food-knowledge/lists';
import { LabelOcrButton } from './label-ocr-button';

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

const CONCERN_LABEL_KEY: Record<FoodConcernCode, string> = {
  'partially-hydrogenated-oil': 'concernPartiallyHydrogenatedOil',
};

const CONCERN_NOTE_KEY: Record<FoodConcernCode, string> = {
  'partially-hydrogenated-oil': 'concernPartiallyHydrogenatedOilNote',
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

  // A scanned water may carry no ingredient text at all (natural mineral
  // waters print a composition instead). Detect it from the OFF metadata so
  // the panel can open an adapted "mineral water" prompt inviting the user to
  // paste the composition printed on the label.
  const autoWater =
    fromRecord === '' &&
    Boolean(name || category) &&
    detectFoodKind({ ...(name ? { name } : {}), ...(category ? { category } : {}) }) === 'water';

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
  const waterHeading = analysis?.kind === 'water' || autoWater;
  // The empty-state prompt is the mineral-composition one once we know this
  // is a water — either from the barcode metadata (autoWater) or from the
  // pasted text itself (the engine re-detects it as water on analyze).
  const waterPrompt = waterHeading;

  return (
    <div className="mt-3 rounded-2xl border border-outline-variant bg-surface/70 p-3 md:p-3.5">
      <div className="flex items-center gap-2">
        <AppIcon
          name={waterHeading ? 'water_drop' : 'menu_book'}
          className={waterHeading ? 'size-4 text-sky-600 dark:text-sky-400' : 'size-4 text-primary'}
        />
        <p className="font-label-md text-label-md font-semibold text-on-surface">
          {waterHeading ? g.waterTitle : g.title}
        </p>
      </div>

      {pending.status === 'loading' && (
        <p className="mt-3 flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <AppIcon name="hourglass_top" className="animate-spin size-4 text-primary" />
          {g.analyzing}
        </p>
      )}

      {fromRecord === '' && pending.status !== 'loading' && (
        <div className="mt-3">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {waterPrompt ? g.waterPasteHelp : g.pasteHelp}
          </p>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (invalid) setInvalid(false);
            }}
            rows={4}
            placeholder={waterPrompt ? g.waterPastePlaceholder : g.pastePlaceholder}
            className="mt-2 w-full resize-y rounded-xl border border-outline-variant bg-surface p-3 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary"
          />
          {invalid && (
            <p className="mt-1 font-label-sm text-label-sm text-rose-600 dark:text-rose-400">
              {g.pasteInvalid}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => run(draft)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary hover:opacity-90 transition-opacity"
            >
              <AppIcon name="search" className="size-4" />
              {g.analyzeCta}
            </button>
            {/* No ingredient text on the scanned product? Photograph the label
                instead of typing it — OCR runs on-device. */}
            <LabelOcrButton
              onText={(text) => {
                setDraft(text);
                run(text);
              }}
            />
          </div>
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

const WATER_PARAM_KEY: Record<string, { label: string; note: string }> = {
  'dry-residue': { label: 'waterParamDryResidue', note: 'waterParamDryResidueNote' },
  sodium: { label: 'waterParamSodium', note: 'waterParamSodiumNote' },
  calcium: { label: 'waterParamCalcium', note: 'waterParamCalciumNote' },
  magnesium: { label: 'waterParamMagnesium', note: 'waterParamMagnesiumNote' },
  potassium: { label: 'waterParamPotassium', note: 'waterParamPotassiumNote' },
  sulphates: { label: 'waterParamSulphates', note: 'waterParamSulphatesNote' },
  chlorides: { label: 'waterParamChlorides', note: 'waterParamChloridesNote' },
  bicarbonates: { label: 'waterParamBicarbonates', note: 'waterParamBicarbonatesNote' },
  nitrates: { label: 'waterParamNitrates', note: 'waterParamNitratesNote' },
};

/** Exported pure body — shared by the course panel and the standalone screen. */
export function FoodKnowledgeBody({ analysis }: { analysis: FoodAnalysis }) {
  const { messages: m } = useLanguage();
  const g = m.foodKnowledge;

  // Water labels print a mineral composition, not an ingredient list — give
  // them an adapted view instead of pretending each line is an ingredient.
  if (analysis.kind === 'water') {
    return <WaterKnowledgeBody analysis={analysis} />;
  }

  const { additives, ingredients } = analysis;
  const concerns = analysis.concerns ?? [];
  // Deep-search answers keyed by folded raw name, so they attach to the row.
  const externalByFolded = new Map(
    analysis.external.map((e) => [foldForMatch(e.name), e]),
  );
  // Use the aggregate set, not only text hits: it also includes trusted OFF
  // allergen tags supplied as a cross-check when label text is abbreviated.
  const allergenGroups = analysis.allergenGroups;
  const showAdditives = additives.length > 0;
  const watch = additives.filter((a) => a.band === 'watch');
  const avoid = additives.filter((a) => a.band === 'avoid');
  const childWarning = additives.some((a) => a.notices.includes('eu-children-warning'));
  const phe = additives.some((a) => a.notices.includes('phenylalanine'));

  const nothingKnown = analysis.total > 0 && analysis.recognized === 0;

  return (
    <div className="mt-3 space-y-3">
      {/* When NOTHING was recognized the panel stays calm and explains why
          (composition/nutrition text pasted as ingredients) — no coverage
          counts: the ring on the accordion carries the bounded label grade. */}
      {nothingKnown && (
        <p className="flex items-start gap-2 rounded-xl bg-surface-container-high/60 px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">
          <AppIcon name="search_off" className="mt-0.5 size-4 shrink-0 text-on-surface-variant" />
          {g.unrecognizedAll}
        </p>
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

      {/* Explicit ingredient-level concerns — separate from both allergens and
          E-number additives so a non-E-number signal cannot disappear. */}
      {concerns.length > 0 && (
        <section className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
          <h4 className="flex items-center gap-1.5 font-label-sm text-label-sm font-semibold text-on-surface">
            <AppIcon name="health_and_safety" className="size-4 text-orange-600 dark:text-orange-400" />
            {g.concernsTitle}
          </h4>
          <ul className="mt-2 space-y-2">
            {concerns.map((concern) => (
              <li key={concern.code}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body-sm text-body-sm font-medium text-on-surface">
                    {g[CONCERN_LABEL_KEY[concern.code] as keyof typeof g]}
                  </span>
                  <span className="rounded-full bg-orange-500/15 px-2 py-0.5 font-label-sm text-label-sm font-semibold text-orange-700 dark:text-orange-300">
                    {concern.level === 'high' ? g.concernBandHigh : g.concernBandWatch}
                  </span>
                </div>
                <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">
                  {g[CONCERN_NOTE_KEY[concern.code] as keyof typeof g]}
                </p>
              </li>
            ))}
          </ul>
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
        {analysis.external.length > 0 && (
          <p className="mt-1 flex items-start gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
            <AppIcon name="public" className="mt-0.5 size-3.5 shrink-0" />
            {g.externalIntro}
          </p>
        )}
        <ul className="mt-1.5 divide-y divide-outline-variant/70 overflow-hidden rounded-xl border border-outline-variant bg-surface/50">
          {ingredients.map((item) => {
            const unknown = !item.recognized;
            // Deep-search answers (key-gated, attributed) attach to the exact
            // unrecognized row they explain — informational only.
            const externalEntry = unknown ? externalByFolded.get(item.normalized) : undefined;
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
                  {(item.concerns ?? []).map((concern) => (
                    <Chip key={concern.code} tone="concern">
                      {g[CONCERN_LABEL_KEY[concern.code] as keyof typeof g]}
                    </Chip>
                  ))}
                  {item.additive && (
                    <Chip tone="additive">
                      <span dir="ltr">{item.additive.code}</span>
                    </Chip>
                  )}
                  {/* When an external answer explains this row, the 'not
                      recognized' tag would only add noise — the attributed
                      summary below IS the extra knowledge. When NOTHING on the
                      list matched, chips would repeat the banner; keep quiet. */}
                  {unknown && !nothingKnown && !externalEntry && (
                    <Chip tone="unknown">{g.ingredientUnknown}</Chip>
                  )}
                </div>
                {externalEntry && (
                  <div className="mt-1.5 rounded-lg bg-surface-container-high/60 px-2.5 py-2">
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {externalEntry.summary}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant/90">
                      <AppIcon name="public" className="size-3" />
                      {g.externalSourceTag}: {externalEntry.source}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/**
 * Adapted view for natural mineral / spring / sparkling / table waters.
 * Water has no ingredient list by regulation — the label prints a mineral
 * composition (mg/L). Every line is informational: a declared natural
 * constituent, never a verdict, and never advice.
 */
function WaterKnowledgeBody({ analysis }: { analysis: FoodAnalysis }) {
  const { messages: m } = useLanguage();
  const g = m.foodKnowledge;
  const params = analysis.water?.parameters ?? [];
  const paramRaws = new Set(params.map((p) => p.raw));
  const leftovers = analysis.ingredients.filter((i) => !paramRaws.has(i.raw));

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-start gap-2.5 rounded-xl bg-surface-container-high/60 px-3 py-2">
        <AppIcon name="water_drop" className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <p className="font-body-sm text-body-sm text-on-surface-variant">{g.waterIntro}</p>
      </div>

      {params.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface/50">
          <h4 className="flex items-center gap-1.5 px-3 pt-2.5 font-label-sm text-label-sm font-semibold text-on-surface">
            <AppIcon name="science" className="size-4 text-primary" />
            {g.waterCompositionTitle}
          </h4>
          <ul className="divide-y divide-outline-variant/70">
            {params.map((p, i) => {
              const meta = WATER_PARAM_KEY[p.key];
              if (!meta) return null;
              return (
                <li key={`${p.key}-${i}`} className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                      {g[meta.label as keyof typeof g]}
                    </span>
                    {p.value && (
                      <span
                        dir="ltr"
                        className="rounded-md bg-surface-container-high px-1.5 py-0.5 font-label-sm text-label-sm text-on-surface-variant"
                      >
                        {p.value} {g.waterUnit}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-label-sm text-label-sm text-on-surface-variant">
                    {g[meta.note as keyof typeof g]}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="px-3 pb-2.5 pt-1 font-label-sm text-label-sm text-on-surface-variant/80">
            {g.waterValuesNote}
          </p>
        </section>
      ) : (
        analysis.total === 0 && (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface/40 px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">
            {g.waterNoData}
          </p>
        )
      )}

      {leftovers.length > 0 && (
        <div className="rounded-xl border border-outline-variant bg-surface/40 px-3 py-2">
          <p className="font-label-sm text-label-sm text-on-surface-variant">{g.waterUnparsed}</p>
          <ul className="mt-1 space-y-1">
            {leftovers.map((l) => (
              <li key={l.index} className="font-body-sm text-body-sm italic text-on-surface-variant/90">
                {l.raw}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: 'allergen' | 'additive' | 'concern' | 'unknown' }) {
  const base = 'rounded-full px-2 py-0.5 font-label-sm text-label-sm ';
  if (tone === 'allergen') return <span className={base + 'bg-amber-500/10 text-amber-700 dark:text-amber-400'}>{children}</span>;
  if (tone === 'additive') return <span className={base + 'bg-primary/10 text-primary'}>{children}</span>;
  if (tone === 'concern') return <span className={base + 'bg-orange-500/15 text-orange-700 dark:text-orange-300'}>{children}</span>;
  if (tone === 'unknown') return <span className={base + 'bg-surface-container-high text-on-surface-variant italic'}>{children}</span>;
  return <span className={base + 'bg-primary/10 text-primary'}>{children}</span>;
}

// Type-only re-export so callers can type panels without deep imports.
export type { AdditiveRole };
