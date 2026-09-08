/**
 * Food label-signal grade — the numeric rank shown on the food accordion ring.
 *
 * This is deliberately NOT Nutri-Score, a complete health score, or a generic
 * ultra-processing judgement. It is a bounded index of signals that can be
 * established from the printed ingredient wording itself:
 *
 *   - EU food additives from the local E-number registry;
 *   - narrowly curated explicit ingredient concerns (currently partially
 *     hydrogenated oils, a source of industrial trans fat);
 *   - recognition coverage, so an unassessed list cannot receive a perfect
 *     score merely because no known E number was found.
 *
 * Allergens never subtract: they are a separate disclosure for people with an
 * allergy/intolerance. Permitted neutral additives also do not subtract.
 * The same input always produces the same auditable result.
 */

import type { FoodAnalysis } from './types';

/** Five-step scale — identical literals to the cosmetic Band so the ring
 * component accepts it without importing the cosmetics engine. */
export type GradeBand = 'excellent' | 'good' | 'moderate' | 'caution' | 'avoid';

export const FOOD_GRADE_WATCH_PENALTY = 15;
export const FOOD_GRADE_AVOID_PENALTY = 60;
export const FOOD_GRADE_CONCERN_WATCH_PENALTY = 15;
/** Explicit high-concern wording is weighted like a strong ingredient signal. */
export const FOOD_GRADE_CONCERN_HIGH_PENALTY = 45;
/** Hard ceiling when an additive is no longer authorised in the EU. */
export const FOOD_GRADE_AVOID_CAP = 34;
/** A high ingredient concern may not read better than the caution band. */
export const FOOD_GRADE_HIGH_CONCERN_CAP = 59;
/** Unknown ingredients limit confidence instead of being treated as clean. */
export const FOOD_GRADE_PARTIAL_COVERAGE_CAP = 94;
export const FOOD_GRADE_LIMITED_COVERAGE_CAP = 79;

/** Band for a food label-signal grade. */
export function gradeBandFor(score: number): GradeBand {
  if (score >= 95) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'caution';
  return 'avoid';
}

export interface FoodGrade {
  score: number;
  band: GradeBand;
}

/**
 * Compute the label-signal grade for a food analysis.
 *
 * Returns null when there is nothing honest to rank: empty lists, mineral
 * waters (which have no ingredient list), and lists where zero items could be
 * recognized. Callers should show an unknown state rather than a false 100.
 */
export function foodLabelGrade(analysis: FoodAnalysis | null | undefined): FoodGrade | null {
  if (!analysis) return null;
  if (analysis.total <= 0 || analysis.kind === 'water' || analysis.recognized <= 0) return null;

  const additives = analysis.additives ?? [];
  const concerns = analysis.concerns ?? [];
  const hasAvoid = additives.some((additive) => additive.band === 'avoid');
  const hasHighConcern = concerns.some((concern) => concern.level === 'high');
  let deduction = 0;

  for (const additive of additives) {
    if (additive.band === 'avoid') deduction += FOOD_GRADE_AVOID_PENALTY;
    else if (additive.band === 'watch') deduction += FOOD_GRADE_WATCH_PENALTY;
  }
  for (const concern of concerns) {
    deduction += concern.level === 'high'
      ? FOOD_GRADE_CONCERN_HIGH_PENALTY
      : FOOD_GRADE_CONCERN_WATCH_PENALTY;
  }

  let score = Math.max(0, Math.min(100, 100 - deduction));
  if (hasAvoid) score = Math.min(score, FOOD_GRADE_AVOID_CAP);
  if (hasHighConcern) score = Math.min(score, FOOD_GRADE_HIGH_CONCERN_CAP);

  // Unknown ingredients are not assumed harmful, but they are not silently
  // treated as clean either. The caps communicate incomplete coverage without
  // inventing a penalty for a specific unknown ingredient.
  const coverage = Math.max(0, Math.min(1, analysis.coverage));
  if (coverage < 0.6) score = Math.min(score, FOOD_GRADE_LIMITED_COVERAGE_CAP);
  else if (analysis.unknownNames.length > 0) {
    score = Math.min(score, FOOD_GRADE_PARTIAL_COVERAGE_CAP);
  }

  const rounded = Math.round(score);
  return { score: rounded, band: gradeBandFor(rounded) };
}

/** Backwards-compatible name for callers shipped with the first food rubric. */
export const additiveGrade = foodLabelGrade;

/** Per-band human impact statement used only by tests/docs (never UI copy). */
export const GRADE_BAND_EXPLANATION: Record<GradeBand, string> = {
  excellent: 'full recognition and no penalized label signals',
  good: 'minor signals or partial recognition',
  moderate: 'several watch signals or limited recognition',
  caution: 'a high ingredient concern or many watch signals',
  avoid: 'contains an additive no longer authorised in the EU',
};
