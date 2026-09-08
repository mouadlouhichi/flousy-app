/**
 * Food-ingredient knowledge analysis (deterministic, local).
 *
 * Pipeline per label:
 *   1. strip the "Ingredients:"-style heading, split the list;
 *   2. per token: family lookup (curated table), EU allergen-group detection
 *      (Annex II alias lists), additive lookup (E-number registry), and narrow
 *      explicit ingredient-concern matching;
 *   3. aggregate: allergen banner set, additive/concern sets, coverage, flags.
 *
 * There is deliberately NO numeric score and NO general "safe/dangerous"
 * verdict in this payload: allergen/additive presence and explicit concern
 * wording are structured signals with regulatory references. A local-unknown
 * name may later be sent to the optional
 * key-gated deep-search slot — which can only ADD attributed informational
 * answers, never change this local result (see src/lib/server/knowledge-search.ts
 * and the analyze route).
 */

import type { AdditiveBand, AdditiveRole } from './types';
import type {
  AllergenGroup,
  AllergenHit,
  AdditiveHit,
  FoodAnalysis,
  FoodAnalyzeOptions,
  FoodConcernHit,
  FoodFlag,
  FoodIngredientAssessment,
} from './types';
import {
  ALLERGEN_GROUPS,
  detectAllergenGroups,
  detectWaterParameter,
  foldForMatch,
  FOOD_DATASET_VERSION,
  FOOD_ROW_COUNT,
  lookupAdditives,
  lookupFoodRow,
} from './lists';
import { detectFoodKind } from './domain';
import { detectFoodConcerns } from './concerns';
import type { WaterParameter } from './types';
import { splitInciList } from '@/lib/ingredient-safety/normalize';

const OFF_ALLERGEN_TAGS: Record<string, AllergenGroup> = {
  'en:gluten': 'gluten', 'fr:gluten': 'gluten',
  'en:crustaceans': 'crustaceans', 'fr:crustaces': 'crustaceans', 'fr:crustacés': 'crustaceans',
  'en:eggs': 'eggs', 'fr:oeufs': 'eggs', 'fr:œufs': 'eggs',
  'en:fish': 'fish', 'fr:poisson': 'fish',
  'en:peanuts': 'peanuts', 'fr:arachides': 'peanuts',
  'en:soybeans': 'soybeans', 'fr:soja': 'soybeans',
  'en:milk': 'milk', 'fr:lait': 'milk',
  'en:nuts': 'nuts', 'fr:noix': 'nuts',
  'en:celery': 'celery', 'fr:celeri': 'celery', 'fr:céleri': 'celery',
  'en:mustard': 'mustard', 'fr:moutarde': 'mustard',
  'en:sesame-seeds': 'sesame', 'fr:sesame': 'sesame', 'fr:sésame': 'sesame',
  'en:sulphur-dioxide': 'sulphites', 'fr:sulfites': 'sulphites', 'en:sulfites': 'sulphites',
  'en:lupin': 'lupin', 'fr:lupin': 'lupin',
  'en:molluscs': 'molluscs', 'fr:mollusques': 'molluscs',
};

/** Drop a leading "Ingrédients:"/"Ingredients:"-style heading if present. */
export function stripIngredientsHeading(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^(?:ingr[ée]dients|ingredients|zutaten|bestanddelen)\s*[:\-]\s*/i);
  return match ? trimmed.slice(match[0].length).trim() : trimmed;
}

export function splitFoodList(text: string): string[] {
  return splitInciList(stripIngredientsHeading(text));
}

export function analyzeFoodText(text: string, opts?: FoodAnalyzeOptions): FoodAnalysis {
  return analyzeFoodIngredientList(splitFoodList(text), opts);
}

export function analyzeFoodIngredientList(
  ingredients: string[],
  opts?: FoodAnalyzeOptions,
): FoodAnalysis {
  const cleaned = ingredients
    .map((t) => String(t).trim())
    .filter((t) => t.length > 0);
  const label = opts?.label?.trim() || undefined;
  const category = opts?.category?.trim() || undefined;

  // Product kind: water labels print a mineral composition, not an
  // ingredient list — see detectFoodKind in domain.ts.
  const kind = detectFoodKind({
    ...(label ? { name: label } : {}),
    ...(category ? { category } : {}),
    text: cleaned.join(' '),
  });
  const waterParameters: WaterParameter[] = [];

  const assessments: FoodIngredientAssessment[] = [];
  const allergenHits: AllergenHit[] = [];
  const additiveHits: AdditiveHit[] = [];
  const concernHits: FoodConcernHit[] = [];
  const seenAdditiveCodes = new Set<string>();
  const seenConcernCodes = new Set<string>();

  cleaned.forEach((raw, index) => {
    const folded = foldForMatch(raw);

    // Water labels: read the declared mineral parameter from each line.
    if (kind === 'water') {
      const param = detectWaterParameter(folded);
      if (param) {
        waterParameters.push({
          key: param.key,
          raw,
          ...(param.value ? { value: param.value } : {}),
        });
      }
    }

    const rowHit = lookupFoodRow(folded);
    // A token can name several additives (nested seasoning sub-lists): keep
    // them ALL so the summary and the label grade are complete. The row
    // chip shows the first one; the label-level list below is deduped per code.
    const tokenAdditives = lookupAdditives(folded);
    const additive = tokenAdditives[0] ?? null;
    const tokenConcerns = detectFoodConcerns(folded, raw);
    const tokenAllergens: AllergenGroup[] = [];
    if (rowHit?.row.allergens) {
      for (const group of rowHit.row.allergens) if (!tokenAllergens.includes(group)) tokenAllergens.push(group);
    }
    // Whole-text allergen scan on this token (label may phrase things like
    // "contient du lait" inside one token).
    for (const group of detectAllergenGroups(folded)) {
      if (!tokenAllergens.includes(group)) tokenAllergens.push(group);
    }
    for (const group of tokenAllergens) {
      allergenHits.push({ group, raw });
    }

    for (const hit of tokenAdditives) {
      // Same additive repeated later on the label is not a second dose — keep
      // the first occurrence only (order preserved by insertion here).
      if (!seenAdditiveCodes.has(hit.code)) {
        seenAdditiveCodes.add(hit.code);
        additiveHits.push(hit);
      }
    }
    for (const hit of tokenConcerns) {
      // A concern code is a label-level signal, not a dose estimate. Keep one
      // summary hit while every matching ingredient row retains its own chip.
      if (!seenConcernCodes.has(hit.code)) {
        seenConcernCodes.add(hit.code);
        concernHits.push(hit);
      }
    }

    const recognized = Boolean(
      rowHit ||
        tokenAdditives.length > 0 ||
        tokenAllergens.length > 0 ||
        tokenConcerns.length > 0 ||
        waterParameters.some((p) => p.raw === raw),
    );
    const assessment: FoodIngredientAssessment = {
      index,
      raw,
      normalized: folded,
      recognized,
      allergens: tokenAllergens,
      concerns: tokenConcerns,
      ...(rowHit
        ? { family: rowHit.row.family, roles: rowHit.row.roles, ...(rowHit.row.note ? { note: rowHit.row.note } : {}), ...(rowHit.row.evidence ? { evidence: rowHit.row.evidence } : {}) }
        : {}),
      ...(additive ? { additive: { code: additive.code, band: additive.band, role: additive.role, notices: additive.notices } } : {}),
    };
    assessments.push(assessment);
  });

  const total = assessments.length;
  const recognized = assessments.filter((a) => a.recognized).length;
  const coverage = total === 0 ? 0 : recognized / total;
  const unknownNames = assessments.filter((a) => !a.recognized).map((a) => a.raw);

  // OFF allergen tags (e.g. from the scanned product page) act as a
  // cross-check when the label text alone is abbreviated or missing.
  const offGroups: AllergenGroup[] = [];
  for (const tag of opts?.offAllergenTags ?? []) {
    const group = OFF_ALLERGEN_TAGS[tag.toLowerCase()];
    if (group && !offGroups.includes(group)) offGroups.push(group);
  }

  const allergenGroups = dedupeOrdered([...allergenHits.map((h) => h.group), ...offGroups]);

  const additiveCodes = additiveHits.map((h) => h.code);
  const hasChildrenWarning = additiveHits.some((h) => h.band === 'watch' && h.notices.includes('eu-children-warning'));
  const hasBanned = additiveHits.some((h) => h.band === 'avoid');
  const hasPhenylalanine = additiveHits.some((h) => h.notices.includes('phenylalanine'));

  const flags: FoodFlag[] = [];
  if (allergenGroups.length > 0) flags.push({ level: 'info', code: 'allergens-present' });
  if (offGroups.length > 0 && allergenGroups.length === 0) {
    // shouldn't happen (offGroups ∪ allergenGroups above), kept for clarity
  }
  if (hasBanned) flags.push({ level: 'warn', code: 'additive-not-permitted' });
  if (additiveHits.some((h) => h.band === 'watch')) flags.push({ level: 'warn', code: 'additive-watch' });
  if (hasChildrenWarning) flags.push({ level: 'warn', code: 'additive-children-warning' });
  if (hasPhenylalanine) flags.push({ level: 'info', code: 'additive-phenylalanine' });
  if (concernHits.some((hit) => hit.level === 'high')) {
    flags.push({ level: 'warn', code: 'ingredient-concern-high' });
  } else if (concernHits.length > 0) {
    flags.push({ level: 'warn', code: 'ingredient-concern-watch' });
  }
  if (unknownNames.length > 0) flags.push({ level: 'warn', code: 'unknown-ingredients' });
  if (total > 0 && unknownNames.length === 0) {
    if (total <= 8 && additiveHits.length === 0) flags.push({ level: 'info', code: 'short-label' });
    if (additiveCodes.length === 0) flags.push({ level: 'info', code: 'no-additives' });
  }
  if (total > 12) flags.push({ level: 'info', code: 'long-label' });

  return {
    ...(label ? { label } : {}),
    ...(category ? { category } : {}),
    ingredients: assessments,
    total,
    recognized,
    coverage,
    unknownNames,
    allergens: allergenHits,
    allergenGroups,
    additives: additiveHits,
    concerns: concernHits,
    flags,
    external: [],
    kind,
    ...(kind === 'water' ? { water: { parameters: waterParameters } } : {}),
    dataset: { version: FOOD_DATASET_VERSION },
  };
}

function dedupeOrdered(groups: AllergenGroup[]): AllergenGroup[] {
  const out: AllergenGroup[] = [];
  for (const group of ALLERGEN_GROUPS) {
    if (groups.includes(group)) out.push(group);
  }
  return out;
}

// Re-export for callers/tests that need the additive band/role labels.
export type { AdditiveBand, AdditiveRole };
export { FOOD_ROW_COUNT };
