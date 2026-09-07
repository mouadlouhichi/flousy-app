/**
 * Food additive-grade — the numeric "rank" shown on the food accordion ring.
 *
 * Scope (per product decision): the ring measures ONLY EU food-additive risk,
 * derived from the same local registry used everywhere else (Reg. (EC) No
 * 1333/2008 context — see lists.ts). It is deliberately NOT a health score,
 * NOT Nutri-Score, and NOT an ultra-processing/quality judgement:
 *
 *   - every food starts at 100;
 *   - a "watch" additive (e.g. E621 glutamate, E320/321, E407, E211, nitrites)
 *     subtracts 15 each — these are EU-permitted but flagged for attention;
 *   - an "avoid" additive (no longer authorised in the EU, e.g. E171) subtracts
 *     60 and additionally caps the grade at 34, so a banned substance never
 *     reads as anything better than "avoid";
 *   - EU-permitted ("neutral") additives do not subtract — being authorised is
 *     the neutral state, not a penalty;
 *   - allergens NEVER subtract: per the EU framing their presence is factual
 *     and only concerns allergic people;
 *   - the result is clamped to 0–100 and rounded, then mapped to a band.
 *
 * The number equals the penalties for the additives the panel actually shows,
 * so the ring can never contradict the expanded list. Informational only.
 */

import type { FoodAnalysis } from './types';

/** Five-step scale — identical literals to the cosmetic Band so the ring
 *  component accepts it without importing the cosmetics engine. */
export type GradeBand = 'excellent' | 'good' | 'moderate' | 'caution' | 'avoid';

export const FOOD_GRADE_WATCH_PENALTY = 15;
export const FOOD_GRADE_AVOID_PENALTY = 60;
/** Hard ceiling when any avoid (banned) additive is present. */
export const FOOD_GRADE_AVOID_CAP = 34;

/** Band for an additive grade (stricter than the cosmetic scale on purpose:
 *  only a no-additive list reaches 95+, a watch additive keeps you under 95). */
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
 * Compute the additive grade for a food analysis.
 * Returns null when there is nothing to rank: empty lists and mineral waters
 * (no ingredient list — their adapted view already explains that).
 */
export function additiveGrade(analysis: FoodAnalysis | null | undefined): FoodGrade | null {
  if (!analysis) return null;
  if (analysis.total <= 0 || analysis.kind === 'water') return null;

  const hasAvoid = analysis.additives.some((a) => a.band === 'avoid');
  let deduction = 0;
  for (const additive of analysis.additives) {
    if (additive.band === 'avoid') deduction += FOOD_GRADE_AVOID_PENALTY;
    else if (additive.band === 'watch') deduction += FOOD_GRADE_WATCH_PENALTY;
  }

  let score = Math.max(0, Math.min(100, 100 - deduction));
  if (hasAvoid) score = Math.min(score, FOOD_GRADE_AVOID_CAP);

  return { score: Math.round(score), band: gradeBandFor(score) };
}

/** Per-band human impact statement used only by tests/docs (never UI copy). */
export const GRADE_BAND_EXPLANATION: Record<GradeBand, string> = {
  excellent: 'no watch/avoid additives',
  good: 'one watch additive, or none',
  moderate: 'several watch additives',
  caution: 'many watch additives',
  avoid: 'contains an additive no longer authorised in the EU',
};
