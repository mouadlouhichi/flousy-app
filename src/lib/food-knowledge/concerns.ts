/**
 * Explicit ingredient-level concern signals for food labels.
 *
 * This registry is deliberately narrow. A printed ingredient list cannot tell
 * us a food's nutrient quantities, so this is not an ultra-processing or
 * nutrition classifier. We only flag wording that is itself meaningful and
 * can be matched without guessing.
 *
 * Sources for the first signal:
 *  - WHO REPLACE (2018): partially hydrogenated oils are the main source of
 *    industrially produced trans-fatty acids and WHO calls for their removal;
 *  - Commission Regulation (EU) 2019/649: trans fat other than that naturally
 *    occurring in animal fat may not exceed 2 g per 100 g of fat in food for
 *    consumers/retail;
 *  - US FDA 2015 final determination: partially hydrogenated oils are no
 *    longer generally recognized as safe (final administrative revocations
 *    took effect in 2023).
 *
 * The label still does not disclose the amount of trans fat in the product.
 * The UI therefore reports a high-concern SOURCE signal, not a compliance
 * verdict and not a claim that the EU limit has been exceeded.
 */

import { foldForMatch, includesTerm } from './lists';
import type { FoodConcernCode, FoodConcernHit } from './types';

interface FoodConcernDefinition {
  code: FoodConcernCode;
  level: FoodConcernHit['level'];
  terms: string[];
  evidence: string[];
}

const CONCERNS: FoodConcernDefinition[] = [
  {
    code: 'partially-hydrogenated-oil',
    level: 'high',
    terms: [
      // English labels.
      'partially hydrogenated',
      'partly hydrogenated',
      // French labels.
      'huile partiellement hydrogénée',
      'huiles partiellement hydrogénées',
      'graisse partiellement hydrogénée',
      'graisses partiellement hydrogénées',
      'matière grasse partiellement hydrogénée',
      'matières grasses partiellement hydrogénées',
      // Common imported EU labels (ES / IT / DE / NL).
      'aceite parcialmente hidrogenado',
      'aceites parcialmente hidrogenados',
      'olio parzialmente idrogenato',
      'oli parzialmente idrogenati',
      'teilweise gehärtetes öl',
      'teilweise gehärtete öle',
      'teilweise hydriertes öl',
      'gedeeltelijk gehydrogeneerde olie',
      'gedeeltelijk gehydrogeneerde oliën',
    ],
    evidence: [
      'WHO REPLACE action package (2018)',
      'Commission Regulation (EU) 2019/649',
      'US FDA final determination on partially hydrogenated oils (2015)',
    ],
  },
];

/** Detect every distinct explicit concern in one folded ingredient token. */
export function detectFoodConcerns(foldedText: string, raw: string): FoodConcernHit[] {
  if (!foldedText) return [];
  const hits: FoodConcernHit[] = [];
  for (const concern of CONCERNS) {
    if (!concern.terms.some((term) => includesTerm(foldedText, foldForMatch(term)))) continue;
    hits.push({
      code: concern.code,
      raw,
      level: concern.level,
      evidence: [...concern.evidence],
    });
  }
  return hits;
}

export const FOOD_CONCERN_COUNT = CONCERNS.length;
