/**
 * Types for the local ingredient-safety engine (CosIng-derived + EU overlay).
 *
 * The engine answers one question about a scanned cosmetic product: "given the
 * INCI list on the label, what do the EU regulatory datasets and the curated
 * risk overlay say about each ingredient?" — it never attempts a medical
 * verdict. See docs/COSMETIC_INGREDIENT_SCORING.md for the model and limits.
 */

/** Where the product is expected to stay on the skin after use. */
export type ProductForm = 'leave-on' | 'rinse-off' | 'unknown';

/**
 * Risk tiers, strongest first. `clean` is only assigned to a *recognized*
 * ingredient that carries no negative signal — unrecognized ingredients are
 * tracked separately through `coverage`, never as "clean".
 */
export type RiskTier = 'prohibited' | 'restricted' | 'caution' | 'watch' | 'clean';

/** Where a signal comes from: the local CosIng snapshot, the EU overlay, or
 *  a key-gated external ingredient database (coverage enrichment only). */
export type TierSource = 'cosing' | 'eu-overlay' | 'vendor';

export interface AnnexCode {
  /** Annex of Regulation (EC) No 1223/2009 referenced by CosIng. */
  annex: string;
  /** Entry number inside that annex (when the text carries one). */
  entry?: string;
}

/** A normalized row of the local CosIng inventory snapshot. */
export interface CosIngRecord {
  /** Canonical INCI name as stored in the dataset. */
  inci: string;
  cas?: string;
  ec?: string;
  /** Cosmetic function labels from CosIng (e.g. "HUMECTANT, SKIN CONDITIONING"). */
  functions?: string[];
  /** Raw restriction text from CosIng (annex codes + conditions, if any). */
  restrictionText?: string;
  /** Annex codes parsed from `restrictionText`. */
  annexCodes: AnnexCode[];
}

export interface Signal {
  /** Stable machine code (UI/i18n key). */
  code: string;
  tier: RiskTier;
  /** Short human label (EN, for tooltips/debug; i18n later). */
  label: string;
  /** Longer human explanation. */
  detail?: string;
  /** Only meaningful when the product is (or may be) leave-on. */
  leaveOnOnly?: boolean;
  /** Only meaningful when the product is rinse-off. */
  rinseOffOnly?: boolean;
  /** Short evidence references, e.g. "Reg (EC) No 1223/2009 Annex II". */
  evidence: string[];
}

export interface IngredientAssessment {
  /** 0-based position in the label INCI list (label order = descending conc.). */
  index: number;
  /** Raw text as it appeared on the label. */
  raw: string;
  /** Normalized lookup key. */
  normalized: string;
  /** Whether any CosIng record matched the name. */
  matched: boolean;
  /** Matched canonical INCI name (when matched). */
  matchedInci?: string;
  cas?: string;
  /** Cosmetic functions from CosIng (when matched and recorded). */
  functions?: string[];
  /** Signals found (CosIng annex codes + EU overlay). Empty when none. */
  signals: Signal[];
  /** Combined tier; null when the ingredient is not recognizable at all. */
  tier: RiskTier | null;
  /** Where the combined tier came from (when tier != null). */
  tierSource?: TierSource;
  /** 0–100 sub-score contribution base for the tier (when tier != null). */
  subScore?: number;
  /** Restriction text as stored in CosIng (annex codes, conditions). */
  restrictionText?: string;
}

export type Band =
  | 'excellent' // >= 85 — green
  | 'good' //     70–84 — light green
  | 'moderate' // 55–69 — yellow
  | 'caution' //  40–54 — orange
  | 'avoid'; //   < 40 — red

export interface ProductFlag {
  level: 'error' | 'warn' | 'info';
  code: string;
  text: string;
}

export interface ProductAssessment {
  /** Optional product label echoed back for the caller's convenience. */
  label?: string;
  /** Product form used for scoring (leave-on defaults when unknown). */
  form: ProductForm;
  ingredients: IngredientAssessment[];
  /** Number of label entries (after cleaning). */
  total: number;
  /** Number of entries that matched CosIng (recognized names). */
  recognized: number;
  /** recognized / total — how much of the list could be evaluated. */
  coverage: number;
  /**
   * 0–100 aggregate score, or null when nothing could be evaluated.
   * Never shown without its `confidence` caveat (see docs).
   */
  score: number | null;
  /**
   * full      — coverage >= 0.9
   * partial   — 0.6 <= coverage < 0.9
   * limited   — coverage < 0.6 (score blends toward the neutral 78)
   */
  confidence: 'full' | 'partial' | 'limited';
  band: Band | null;
  /** Strongest tier seen among ingredients (null when all unknown). */
  worstTier: RiskTier | null;
  /** Names that could not be matched against the local dataset. */
  unknownIngredients: string[];
  flags: ProductFlag[];
  /** Set when the score was hard-capped (e.g. an EU-prohibited ingredient). */
  cappedReason?: string;
  /**
   * Set when a key-gated external ingredient database supplied extra
   * recognitions for names the local snapshot missed (coverage enrichment).
   */
  vendorEnriched?: boolean;
  /** Snapshot metadata so callers can surface data freshness. */
  dataset: { rows: number; snapshot: string; version: string };
}

export const TIER_ORDER: RiskTier[] = ['prohibited', 'restricted', 'caution', 'watch', 'clean'];

export function strongerTier(a: RiskTier | null, b: RiskTier | null): RiskTier | null {
  if (!a) return b;
  if (!b) return a;
  return TIER_ORDER.indexOf(a) <= TIER_ORDER.indexOf(b) ? a : b;
}
