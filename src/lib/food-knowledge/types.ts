/**
 * Food-ingredient knowledge analysis — types.
 *
 * Scope: the FOOD side of the label-knowledge feature. The COSMETIC side is
 * the existing INCI engine (src/lib/ingredient-safety/*). Both sides share a
 * structural philosophy but the analysis payload itself has NO numeric score.
 * Allergens, additives and explicit concern-source wording are reported as
 * structured information with regulatory references. The course accordion's
 * separate, bounded label-signal index lives in grade.ts; it is not a general
 * nutrition/health verdict. See docs/FEATURE_LABEL_KNOWLEDGE.md.
 */

export type FoodDomain = 'food' | 'cosmetic' | 'unknown';

/** High-level "what kind of ingredient is this" — used for localized chips. */
export type FoodFamily =
  | 'dairy'
  | 'egg'
  | 'meat-fish'
  | 'cereal'
  | 'fruit-veg'
  | 'fat-oil'
  | 'sugar'
  | 'salt'
  | 'water'
  | 'culture'
  | 'herb-spice'
  | 'nut-seed'
  | 'legume'
  | 'other';

/** The 14 EU Annex II (Reg. 1169/2011) allergen groups we recognize. */
export type AllergenGroup =
  | 'gluten'
  | 'crustaceans'
  | 'eggs'
  | 'fish'
  | 'peanuts'
  | 'soybeans'
  | 'milk'
  | 'nuts'
  | 'celery'
  | 'mustard'
  | 'sesame'
  | 'sulphites'
  | 'lupin'
  | 'molluscs';

/** Relative scrutiny for a food additive (contextual, not a health verdict). */
export type AdditiveBand = 'neutral' | 'watch' | 'avoid';

export type AdditiveRole =
  | 'colour'
  | 'preservative'
  | 'antioxidant'
  | 'emulsifier'
  | 'sweetener'
  | 'acidity'
  | 'stabiliser'
  | 'thickener'
  | 'raising'
  | 'glazing'
  | 'flavour-enhancer'
  | 'other';

export interface AllergenHit {
  /** EU group code (localized client-side). */
  group: AllergenGroup;
  /** The raw ingredient text that triggered the hit (e.g. "lait de vache"). */
  raw: string;
}

export interface AdditiveHit {
  /** Canonical E number, e.g. "E330". */
  code: string;
  /** Raw ingredient text the additive was read from. */
  raw: string;
  band: AdditiveBand;
  role: AdditiveRole;
  /** Extra EU notice codes, e.g. 'eu-children-warning' | 'eu-banned'. */
  notices: string[];
}

/**
 * Stable codes for explicit, non-additive ingredient wording that deserves a
 * prominent label-level signal. This is intentionally NOT a general nutrition
 * taxonomy: each code must be detectable from the wording alone.
 */
export type FoodConcernCode = 'partially-hydrogenated-oil';
export type FoodConcernLevel = 'watch' | 'high';

export interface FoodConcernHit {
  code: FoodConcernCode;
  /** The raw ingredient text that triggered the signal. */
  raw: string;
  level: FoodConcernLevel;
  /** Auditable source labels; explanatory prose is localized client-side. */
  evidence: string[];
}

export interface FoodIngredientAssessment {
  index: number;
  /** Raw ingredient text as written on the label. */
  raw: string;
  /** Accent-folded, lower-cased matching key. */
  normalized: string;
  /** True when the token matched a known family / allergen / additive. */
  recognized: boolean;
  family?: FoodFamily;
  roles?: string[];
  allergens: AllergenGroup[];
  additive?: { code: string; band: AdditiveBand; role: AdditiveRole; notices: string[] };
  /** Explicit ingredient-level concern signals attached to this row. */
  concerns: FoodConcernHit[];
  /** Short factual note (internal / evidence; not rendered as UI copy). */
  note?: string;
  evidence?: string[];
}

export type FoodFlagLevel = 'info' | 'warn';
export interface FoodFlag {
  level: FoodFlagLevel;
  code: string;
}

/** One informational answer from the optional key-gated deep-search slot. */
export interface ExternalFoodKnowledge {
  /** Normalized name this answer refers to (must match a local unknown). */
  name: string;
  /** Free-text answer from the external provider — always attributed. */
  summary: string;
  /** Provider/source label (from the server config, never client-supplied). */
  source: string;
}

/**
 * Product-kind classification (food side). Some scanned products do not
 * carry an ingredient list at all — natural mineral waters are the prime
 * case (their label declares a mineral composition instead), and many
 * drinks are water-based. `kind` lets the UI adapt without pretending a
 * composition table is an ingredient list.
 */
export type FoodProductKind = 'standard' | 'water' | 'drink';

/** One mineral-parameter line parsed from a water label, e.g. "Sodium 26". */
export interface WaterParameter {
  /** Stable code (e.g. 'sodium') — localized client-side. */
  key: string;
  /** Raw line as printed on the label. */
  raw: string;
  /** Numeric value printed on the label, when present (string to survive OCR). */
  value?: string;
}

export interface FoodAnalysis {
  /** Optional product label echoed back. */
  label?: string;
  /** Optional OFF-style category echoed back (form/context hints). */
  category?: string;
  ingredients: FoodIngredientAssessment[];
  total: number;
  recognized: number;
  coverage: number;
  unknownNames: string[];
  allergens: AllergenHit[];
  /** Distinct EU groups present (ordered by Annex II). */
  allergenGroups: AllergenGroup[];
  additives: AdditiveHit[];
  /** Distinct explicit ingredient-level concerns detected on the label. */
  concerns: FoodConcernHit[];
  flags: FoodFlag[];
  /** External (third-party) informational answers; may be empty. */
  external: ExternalFoodKnowledge[];
  /** Set when the deep-search slot contributed entries. */
  deepSearched?: boolean;
  /** Product-kind classification (drives the adapted water/drink views). */
  kind: FoodProductKind;
  /** Parsed mineral composition — only present for `kind === 'water'`. */
  water?: { parameters: WaterParameter[] };
  /** Local knowledge base metadata. */
  dataset: { version: string };
}

export interface FoodAnalyzeOptions {
  label?: string;
  category?: string;
  /** Optional OFF `allergens_tags` (e.g. "en:milk") — cross-check only. */
  offAllergenTags?: string[];
}

export interface FoodKnowledgeRow {
  /** Matching keys: accent-folded lowercase ingredient spellings. */
  keys: string[];
  family: FoodFamily;
  /** EU allergen group(s) this ingredient inherently belongs to (if any). */
  allergens?: AllergenGroup[];
  roles?: string[];
  /** Short factual note (evidence style; never rendered as UI copy). */
  note?: string;
  evidence?: string[];
}
