/**
 * Public contracts for the ingredient identity, evidence, and assessment model.
 *
 * These concepts are deliberately separate:
 * - identity answers whether a label name can be resolved;
 * - evidence records what a dated source says;
 * - applicability records whether the product context is sufficient;
 * - assessment is a cautious interpretation and may be withheld.
 *
 * A glossary/inventory match never means authorised, compliant, or safe.
 */

export const MAX_INGREDIENT_TEXT_LENGTH = 12_000;

export type ProductForm = 'leave-on' | 'rinse-off' | 'unknown';

/** Historical API/UI tiers. `clean` is retained for old snapshots only and is
 * never inferred from identity membership by the current engine. */
export type RiskTier = 'prohibited' | 'restricted' | 'caution' | 'watch' | 'clean';

export type TierSource = 'structured-eu' | 'curated' | 'historical' | 'vendor';

export type IdentityStatus =
  | 'official-glossary'
  | 'legacy-inventory'
  | 'externally-identified'
  | 'unidentified';

export type EvidenceKind =
  | 'regulatory'
  | 'comfort'
  | 'historical'
  | 'identity'
  | 'hazard-assessment'
  | 'external';

export type Applicability = 'applies' | 'does-not-apply' | 'conditions-unknown';

export interface AnnexCode {
  annex: string;
  entry?: string;
}

export interface IngredientIdentity {
  status: IdentityStatus;
  canonicalName?: string;
  /** Dated source that resolved the name; this is identity evidence only. */
  source?: string;
  sourceVersion?: string;
  sourceUrl?: string;
  entry?: string;
  via?: 'exact' | 'alias' | 'paren-stripped' | 'external' | 'none';
}

/** A normalized local ingredient record. Functions come from the older CosIng
 * inventory; glossary fields come from Decision (EU) 2025/1175. */
export interface CosIngRecord {
  inci: string;
  cas?: string;
  ec?: string;
  functions?: string[];
  /** Legacy free text retained as provenance; never parsed into legal status. */
  restrictionText?: string;
  /** Legacy parsed references retained for compatibility/debug only. */
  annexCodes: AnnexCode[];
  identitySource: 'official-glossary' | 'legacy-inventory';
  glossaryEntry?: string;
  glossaryName?: string;
  legacyInventoryMatch?: boolean;
}

export interface RegulatoryCondition {
  jurisdiction: 'EU';
  framework: 'Regulation (EC) No 1223/2009';
  annex: 'II' | 'III' | 'IV' | 'V' | 'VI';
  entry: string;
  /** Annex II is a prohibited-list match. Other annexes carry conditions that
   * cannot normally be resolved from an INCI list alone. */
  legalRole: 'prohibited-list' | 'restricted-list' | 'positive-list-with-conditions';
  applicability: Applicability;
  applicabilityReason: string;
  productType?: string;
  maxConcentration?: string;
  otherRestrictions?: string;
  warnings?: string;
  regulation?: string;
  effectiveAsOf: string;
  sourceUpdated: string;
  sourceUrl: string;
}

export interface EvidenceReference {
  title: string;
  url?: string;
  sourceVersion?: string;
  retrievedAt?: string;
}

export interface Signal {
  code: string;
  tier: RiskTier;
  kind: EvidenceKind;
  label: string;
  detail?: string;
  leaveOnOnly?: boolean;
  rinseOffOnly?: boolean;
  applicability?: Applicability;
  /** Human-readable citations retained for old UI and exports. */
  evidence: string[];
  references?: EvidenceReference[];
  regulatory?: RegulatoryCondition;
}

export interface ExternalIngredientEvidence {
  provider: string;
  reportedName: string;
  verdict?: string;
  score?: number;
  found?: boolean;
  retrievedAt?: string;
  /** Always true: provider output is provenance, not a local safety verdict. */
  informationalOnly: true;
}

export interface IngredientAssessment {
  index: number;
  raw: string;
  normalized: string;
  /** Compatibility alias for identity.status !== unidentified. */
  matched: boolean;
  matchedInci?: string;
  identity: IngredientIdentity;
  cas?: string;
  functions?: string[];
  signals: Signal[];
  /** Strongest supported concern. Null means no assessed signal, not "safe". */
  tier: RiskTier | null;
  tierSource?: TierSource;
  subScore?: number;
  /** Points this row removed from the 100-point index (informational; the
   * per-ingredient rank weight). 0/absent = no contribution. */
  deduction?: number;
  /** Legacy informational text; never itself establishes legal status. */
  restrictionText?: string;
  externalEvidence?: ExternalIngredientEvidence[];
  assessmentState:
    | 'assessed-signal'
    | 'identified-no-assessment'
    | 'externally-identified'
    | 'unidentified';
}

export type Band = 'excellent' | 'good' | 'moderate' | 'caution' | 'avoid';

export interface ProductFlag {
  level: 'error' | 'warn' | 'info';
  code: string;
  text: string;
}

export type ParserDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface ParserDiagnostic {
  code: string;
  severity: ParserDiagnosticSeverity;
  message: string;
  offset?: number;
  length?: number;
}

export interface ParserSummary {
  valid: boolean;
  reviewed: boolean;
  source: 'typed' | 'paste' | 'ocr' | 'provider' | 'unknown';
  diagnostics: ParserDiagnostic[];
}

/**
 * Why a numeric index is or is not published.
 *
 * `available-with-unresolved-conditions` is the ordinary case for a real
 * cosmetic: EU positive/restricted lists carry concentration and product-type
 * conditions that an ingredient list cannot resolve. The index is published
 * with a mandatory caveat and reduced confidence rather than being withheld,
 * because withholding it for the presence of an ordinary preservative made the
 * feature unscoreable in practice.
 *
 * Withholding is reserved for the cases where publishing a number would be
 * misleading: no ingredients, an unreviewed/invalid parse, an unknown product
 * form, an unresolved Annex II (prohibited-list) exception, or a list the dated
 * corpus cannot describe at all.
 */
export type ScoreStatus =
  | 'available'
  | 'available-with-unresolved-conditions'
  | 'withheld-invalid-parse'
  | 'withheld-review-required'
  | 'withheld-form-unknown'
  | 'withheld-conditions-unknown'
  | 'withheld-insufficient-evidence'
  | 'withheld-no-ingredients';

export interface ProductAssessment {
  label?: string;
  form: ProductForm;
  formSource: 'explicit' | 'inferred' | 'unknown';
  ingredients: IngredientAssessment[];
  total: number;
  /** Identity coverage (local glossary/inventory + attributed external identity). */
  recognized: number;
  localRecognized: number;
  externallyIdentified: number;
  coverage: number;
  /** Ingredients carrying assessment evidence, distinct from identity coverage. */
  assessed: number;
  assessmentCoverage: number;
  score: number | null;
  scoreStatus: ScoreStatus;
  confidence: 'full' | 'partial' | 'limited';
  band: Band | null;
  worstTier: RiskTier | null;
  unknownIngredients: string[];
  flags: ProductFlag[];
  parser: ParserSummary;
  cappedReason?: string;
  vendorEnriched?: boolean;
  dataset: {
    rows: number;
    snapshot: string;
    version: string;
    glossaryRows?: number;
    inventoryRows?: number;
    regulationAsOf?: string;
    engineVersion?: string;
  };
  assessedAt: string;
}

export const TIER_ORDER: RiskTier[] = ['prohibited', 'restricted', 'caution', 'watch', 'clean'];

export function strongerTier(a: RiskTier | null, b: RiskTier | null): RiskTier | null {
  if (!a) return b;
  if (!b) return a;
  return TIER_ORDER.indexOf(a) <= TIER_ORDER.indexOf(b) ? a : b;
}
