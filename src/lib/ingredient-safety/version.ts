/** Client-safe version identities for assessment and cache invalidation. */

export const INGREDIENT_ENGINE_VERSION = 'ingredient-evidence-v2';
export const INGREDIENT_ENGINE_RELEASED_AT = '2026-09-08T00:00:00.000Z';
export const INGREDIENT_IDENTITY_DATASET_VERSION = 'ingredient-identity-2025-1175-v1';
export const REGULATORY_DATASET_VERSION = 'eu-cosmetics-annexes-2026-05-26-v1';

/** Any engine or source-corpus update creates a distinct completed/in-flight
 * client cache identity, even when text and product context are unchanged. */
export const INGREDIENT_ANALYSIS_CACHE_VERSION = [
  'ingredient-request-v3',
  INGREDIENT_ENGINE_VERSION,
  INGREDIENT_IDENTITY_DATASET_VERSION,
  REGULATORY_DATASET_VERSION,
].join('+');
