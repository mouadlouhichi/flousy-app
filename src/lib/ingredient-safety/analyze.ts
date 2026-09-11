/** Deterministic ingredient identity/evidence analysis. */

import type {
  Band,
  ExternalIngredientEvidence,
  IngredientAssessment,
  ParserDiagnostic,
  ParserSummary,
  ProductAssessment,
  ProductFlag,
  ProductForm,
  RiskTier,
  ScoreStatus,
  Signal,
  TierSource,
} from './types';
import { MAX_INGREDIENT_TEXT_LENGTH, strongerTier } from './types';
import { loadCosingDataset, lookupIngredient } from './dataset';
import { lookupOverlay } from './eu-lists';
import { normalizeInciToken, parseInciList } from './normalize';
import { inferProductForm } from './form';
import {
  EU_REGULATION_AS_OF,
  lookupRegulatorySignals,
} from './regulatory';
import {
  INGREDIENT_ENGINE_RELEASED_AT,
  INGREDIENT_ENGINE_VERSION,
  REGULATORY_DATASET_VERSION,
} from './version';

export { inferProductForm } from './form';
export { INGREDIENT_ENGINE_RELEASED_AT, INGREDIENT_ENGINE_VERSION } from './version';

/** Point cost of the strongest listed signal on an ingredient row.
 *
 * `restricted` covers Annex III restriction entries and positive-list entries
 * whose own wording excludes the selected product form. Ordinary positive-list
 * entries (Annexes IV–VI: preservatives, colorants, UV filters) are `watch`,
 * because the annex authorises the substance and only the conditions are
 * unresolvable from a label. */
const DEDUCTION: Record<RiskTier, number> = {
  prohibited: 100,
  restricted: 30,
  caution: 22,
  watch: 10,
  clean: 0,
};
/** Below this share of IDENTIFIED ingredients the dated corpus cannot describe
 * the list well enough to publish any index. Identity coverage — not the share
 * of rows carrying a signal — is the right gate: a label made entirely of
 * recognised-but-signal-free ingredients is a legitimate "no listed signal"
 * result, while a label we cannot read is not. */
const MIN_IDENTITY_COVERAGE = 0.6;
const PROHIBITED_CAP = 35;
/** A product carrying an Annex-III-style restriction entry may not read as a
 * clean result even when the other rows are unremarkable. */
const RESTRICTED_CAP = 59;
/**
 * Aggregate deduction → index conversion.
 *
 * A plain sum saturated at 0 for any ordinary supermarket cosmetic (a
 * preservative plus three declared fragrance allergens already exceeds 100
 * points), which made every imperfect product display the same "worst" number
 * and destroyed the ranking. Penalties are therefore accumulated on a
 * saturating curve: each additional signal removes a share of the *remaining*
 * index, so the number stays monotonic in the underlying evidence, never
 * saturates, and still reaches the floor for genuinely severe labels.
 *
 *   index = 100 · e^(−Σ deductions / 100)
 *
 * Per-row `deduction` values remain the raw, explainable point costs used by
 * the "main risk drivers" breakdown; only their aggregation is saturating.
 */
const DEDUCTION_DECAY = 100;

function indexFromDeductions(deductionTotal: number): number {
  if (deductionTotal <= 0) return 100;
  return Math.round(100 * Math.exp(-deductionTotal / DEDUCTION_DECAY));
}
/** An index computed on a partially recognised list may not be presented as a
 * clean result. Same caps as the food-label rubric, so both surfaces behave
 * identically when coverage is incomplete. */
const PARTIAL_COVERAGE_CAP = 94;
const LIMITED_COVERAGE_CAP = 79;

export interface AnalyzeOptions {
  form?: ProductForm;
  label?: string;
  category?: string;
  source?: ParserSummary['source'];
  /** OCR drafts must explicitly set this true after editable text/token review. */
  reviewed?: boolean;
  /** Route/persistence may inject wall-clock time; pure calls use release time. */
  assessedAt?: string;
  /** External provider observations. They never set a tier or alter a score. */
  vendorEvidence?: ReadonlyMap<string, ExternalIngredientEvidence>;
}

export interface AnalyzeResult extends ProductAssessment {}

function pushSignal(target: Signal[], signal: Signal): void {
  const identity = `${signal.code}:${signal.regulatory?.annex ?? ''}:${signal.regulatory?.entry ?? ''}`;
  if (!target.some((item) => `${item.code}:${item.regulatory?.annex ?? ''}:${item.regulatory?.entry ?? ''}` === identity)) {
    target.push(signal);
  }
}

function tierSourceFor(signal: Signal): TierSource {
  if (signal.kind === 'regulatory') return 'structured-eu';
  if (signal.kind === 'historical') return 'historical';
  if (signal.kind === 'external') return 'vendor';
  return 'curated';
}

function contextSignal(signal: Signal, form: ProductForm): Signal | null {
  if (signal.leaveOnOnly) {
    if (form === 'rinse-off') return null;
    return {
      ...signal,
      applicability: form === 'leave-on' ? 'applies' : 'conditions-unknown',
      detail: form === 'unknown'
        ? `${signal.detail ?? ''} Product form is unknown, so applicability is unresolved.`.trim()
        : signal.detail,
    };
  }
  if (signal.rinseOffOnly) {
    if (form === 'leave-on') return null;
    return {
      ...signal,
      applicability: form === 'rinse-off' ? 'applies' : 'conditions-unknown',
    };
  }
  return signal;
}

function assessIngredient(
  raw: string,
  index: number,
  context: { form: ProductForm; category?: string },
  vendorEvidence?: ReadonlyMap<string, ExternalIngredientEvidence>,
): IngredientAssessment {
  const normalized = normalizeInciToken(raw);
  const lookup = lookupIngredient(raw);
  const record = lookup.record;
  const external = vendorEvidence?.get(normalized);
  const locallyMatched = Boolean(record);
  const externallyMatched = !locallyMatched && Boolean(external && external.found !== false);
  const matched = locallyMatched || externallyMatched;
  const identity = record
    ? {
        status: record.identitySource,
        canonicalName: record.glossaryName ?? record.inci,
        source: record.identitySource === 'official-glossary'
          ? 'Commission Implementing Decision (EU) 2025/1175'
          : 'CosIng Ingredients & Fragrance Inventory (legacy metadata)',
        sourceVersion: record.identitySource === 'official-glossary' ? 'EU 2025/1175' : '2019-03-13',
        sourceUrl: record.identitySource === 'official-glossary'
          ? 'https://eur-lex.europa.eu/eli/dec_impl/2025/1175/oj'
          : 'https://ec.europa.eu/growth/tools-databases/cosing/',
        ...(record.glossaryEntry ? { entry: record.glossaryEntry } : {}),
        via: lookup.via,
      } as const
    : externallyMatched
      ? {
          status: 'externally-identified' as const,
          canonicalName: external?.reportedName,
          source: external?.provider,
          sourceVersion: 'external-current-response',
          via: 'external' as const,
        }
      : { status: 'unidentified' as const, via: 'none' as const };

  const base: IngredientAssessment = {
    index,
    raw,
    normalized,
    matched,
    ...(identity.canonicalName ? { matchedInci: identity.canonicalName } : {}),
    identity,
    ...(record?.cas ? { cas: record.cas } : {}),
    ...(record?.functions ? { functions: record.functions } : {}),
    ...(record?.restrictionText ? { restrictionText: record.restrictionText } : {}),
    signals: [],
    tier: null,
    ...(external ? { externalEvidence: [external] } : {}),
    assessmentState: matched ? 'identified-no-assessment' : 'unidentified',
  };
  if (!normalized) return base;

  const keys = new Set<string>([normalized]);
  if (record) keys.add(normalizeInciToken(record.glossaryName ?? record.inci));
  const signals: Signal[] = [];
  for (const key of keys) {
    for (const regulatory of lookupRegulatorySignals(key, context)) pushSignal(signals, regulatory);
    for (const hit of lookupOverlay(key)) {
      const contextualized = contextSignal(hit.signal, context.form);
      if (contextualized) pushSignal(signals, contextualized);
    }
  }

  let tier: RiskTier | null = null;
  let tierSource: TierSource | undefined;
  for (const signal of signals) {
    if (signal.applicability === 'does-not-apply') continue;
    const candidate = strongerTier(tier, signal.tier);
    if (candidate !== tier) tierSource = tierSourceFor(signal);
    tier = candidate;
  }

  base.signals = signals;
  base.tier = tier;
  base.tierSource = tierSource;
  base.assessmentState = tier
    ? 'assessed-signal'
    : externallyMatched
      ? 'externally-identified'
      : locallyMatched
        ? 'identified-no-assessment'
        : 'unidentified';
  return base;
}

function exposureWeight(position: number, total: number): number {
  if (total <= 1) return 1;
  return Math.round((0.3 + 0.7 * ((total - 1 - position) / (total - 1))) * 100) / 100;
}

function bandFor(score: number): Band {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'moderate';
  if (score >= 40) return 'caution';
  return 'avoid';
}

/** Confidence tracks IDENTITY coverage (can we read the list?) and is capped at
 * `partial` while any EU condition is unresolved, because an unresolved
 * condition limits what the index can mean even on a fully read label. */
function confidenceFor(coverage: number, hasUnresolvedConditions: boolean): ProductAssessment['confidence'] {
  const base = coverage >= 0.9 ? 'full' : coverage >= 0.7 ? 'partial' : 'limited';
  if (hasUnresolvedConditions && base === 'full') return 'partial';
  return base;
}

interface AnalysisInput {
  ingredients: string[];
  parserDiagnostics: ParserDiagnostic[];
  parserValid: boolean;
}

function scoreStatusFor(input: {
  total: number;
  parser: ParserSummary;
  form: ProductForm;
  /** Share of rows the dated corpus could identify. */
  identityCoverage: number;
  /** Rows carrying at least one assessed signal. */
  assessed: number;
  /** An Annex II (prohibited-list) match whose exception cannot be resolved. */
  hasUnresolvedProhibition: boolean;
  /** Any EU condition that cannot be resolved from the label. */
  hasUnresolvedConditions: boolean;
}): ScoreStatus {
  if (input.total === 0) return 'withheld-no-ingredients';
  if (!input.parser.valid) return 'withheld-invalid-parse';
  if (input.parser.source === 'ocr' && !input.parser.reviewed) return 'withheld-review-required';
  if (input.form === 'unknown') return 'withheld-form-unknown';
  if (input.hasUnresolvedProhibition) return 'withheld-conditions-unknown';
  // Nothing the corpus can say about this list: publishing "no listed signal"
  // would read as a positive finding, so the index is withheld instead.
  if (input.assessed === 0) return 'withheld-insufficient-evidence';
  if (input.identityCoverage < MIN_IDENTITY_COVERAGE) return 'withheld-insufficient-evidence';
  if (input.hasUnresolvedConditions) return 'available-with-unresolved-conditions';
  return 'available';
}

function analyzePrepared(input: AnalysisInput, opts?: AnalyzeOptions): AnalyzeResult {
  if (
    (opts?.label?.trim().length ?? 0) > 200
    || (opts?.category?.trim().length ?? 0) > 200
    || (opts?.vendorEvidence?.size ?? 0) > 300
  ) throw new RangeError('ingredient analysis context is too long');
  const ingredients = input.ingredients.map((item) => String(item).trim()).filter(Boolean);
  const total = ingredients.length;
  const label = opts?.label?.trim() || undefined;
  const category = opts?.category?.trim() || undefined;
  const inferredForm = inferProductForm(category, label);
  const form = opts?.form ?? inferredForm;
  const formSource: ProductAssessment['formSource'] = opts?.form
    ? opts.form === 'unknown' ? 'unknown' : 'explicit'
    : inferredForm === 'unknown' ? 'unknown' : 'inferred';
  const source = opts?.source ?? 'typed';
  const parser: ParserSummary = {
    valid: input.parserValid,
    reviewed: source !== 'ocr' || opts?.reviewed === true,
    source,
    diagnostics: input.parserDiagnostics,
  };

  const assessments = ingredients.map((raw, index) =>
    assessIngredient(raw, index, { form, category }, opts?.vendorEvidence),
  );
  const recognized = assessments.filter((item) => item.matched);
  const localRecognized = assessments.filter((item) => item.identity.status === 'official-glossary' || item.identity.status === 'legacy-inventory');
  const externallyIdentified = assessments.filter((item) => item.identity.status === 'externally-identified');
  const assessed = assessments.filter((item) => item.assessmentState === 'assessed-signal');
  const coverage = total === 0 ? 0 : recognized.length / total;
  const assessmentCoverage = total === 0 ? 0 : assessed.length / total;
  const hasUnknownConditions = assessments.some((item) =>
    item.signals.some((signal) => signal.applicability === 'conditions-unknown'),
  );
  // Only an unresolved Annex II exception is a genuine "we cannot say whether
  // this substance is prohibited here" case. Positive/restricted-list
  // conditions are published with a caveat instead of blocking the index.
  const hasUnresolvedProhibition = assessments.some((item) =>
    item.signals.some((signal) =>
      signal.applicability === 'conditions-unknown' && signal.regulatory?.annex === 'II',
    ),
  );
  const scoreStatus = scoreStatusFor({
    total,
    parser,
    form,
    identityCoverage: coverage,
    assessed: assessed.length,
    hasUnresolvedProhibition,
    hasUnresolvedConditions: hasUnknownConditions,
  });

  let deductionTotal = 0;
  let hasUnconditionalProhibited = false;
  for (const assessment of assessments) {
    if (!assessment.tier) continue;
    const legal = assessment.signals.some((signal) => signal.kind === 'regulatory');
    const penalty = DEDUCTION[assessment.tier];
    if (assessment.signals.some((signal) => signal.regulatory?.legalRole === 'prohibited-list' && signal.applicability === 'applies')) {
      hasUnconditionalProhibited = true;
    }
    const weight = legal ? 1 : exposureWeight(assessment.index, total);
    const deduction = Math.round(penalty * weight);
    assessment.subScore = Math.max(0, 100 - deduction);
    assessment.deduction = deduction;
    deductionTotal += deduction;
  }

  const worstTier = assessments.reduce<RiskTier | null>(
    (current, item) => strongerTier(current, item.tier),
    null,
  );

  let score: number | null = null;
  let cappedReason: string | undefined;
  if (scoreStatus === 'available' || scoreStatus === 'available-with-unresolved-conditions') {
    score = indexFromDeductions(deductionTotal);
    // Severity floors: a listed restriction or prohibition may never be
    // averaged away by the unremarkable rows around it.
    if (hasUnconditionalProhibited || worstTier === 'prohibited') {
      score = Math.min(score, PROHIBITED_CAP);
      cappedReason = 'eu-annex-ii-name-match';
    } else if (worstTier === 'restricted') {
      score = Math.min(score, RESTRICTED_CAP);
      cappedReason = 'eu-restriction-floor';
    }
    // Incomplete identity coverage may never read as a clean result.
    if (coverage < 0.7) {
      score = Math.min(score, LIMITED_COVERAGE_CAP);
      cappedReason = 'limited-identity-coverage';
    } else if (coverage < 0.9) {
      score = Math.min(score, PARTIAL_COVERAGE_CAP);
      cappedReason = cappedReason ?? 'partial-identity-coverage';
    }
  }
  const flags: ProductFlag[] = [];
  if (!parser.valid) {
    flags.push({
      level: 'error',
      code: 'parser-review-required',
      text: 'The ingredient structure is incomplete or unbalanced. Review the extracted text and parsed rows before relying on any match.',
    });
  }
  if (source === 'ocr' && !parser.reviewed) {
    flags.push({
      level: 'warn',
      code: 'ocr-review-required',
      text: 'OCR text is an editable draft. Confirm the text and parsed ingredient rows before analysis.',
    });
  }
  const annexTwo = assessments.filter((item) =>
    item.signals.some((signal) => signal.regulatory?.annex === 'II' && signal.applicability === 'applies'),
  );
  if (annexTwo.length > 0) {
    flags.push({
      level: 'error',
      code: 'eu-annex-ii-name-match',
      text: `${annexTwo.length} exact label name match${annexTwo.length === 1 ? 'es' : ''} an EU Annex II record. Verify identity, exceptions, jurisdiction, and the official source; this is not a product-compliance determination.`,
    });
  }
  const conditional = assessments.filter((item) =>
    item.signals.some((signal) => signal.kind === 'regulatory' && signal.applicability === 'conditions-unknown'),
  );
  if (conditional.length > 0) {
    flags.push({
      level: 'warn',
      code: 'regulatory-conditions-unknown',
      text: `${conditional.length} ingredient${conditional.length === 1 ? ' has' : 's have'} EU use conditions that cannot be resolved from label order alone.`,
    });
  }
  const formConflicts = assessments.filter((item) =>
    item.signals.some((signal) => signal.regulatory?.legalRole === 'positive-list-with-conditions' && signal.applicability === 'applies'),
  );
  if (formConflicts.length > 0) {
    flags.push({
      level: 'warn',
      code: 'positive-list-form-conflict',
      text: `${formConflicts.length} positive-list entr${formConflicts.length === 1 ? 'y does' : 'ies do'} not cover the selected product form. Verify the product type and the official annex entry.`,
    });
  }
  const allergens = assessments.filter((item) => item.signals.some((signal) => signal.code === 'eu-fragrance-allergen'));
  if (allergens.length > 0) {
    flags.push({
      level: 'warn',
      code: 'fragrance-allergen-name-matches',
      text: `${allergens.length} fragrance-allergen name match${allergens.length === 1 ? 'es' : ''}; declaration obligations depend on concentration, product form, and transition status.`,
    });
  }
  if (assessments.some((item) => item.signals.some((signal) => signal.code === 'fragrance-generic'))) {
    flags.push({
      level: 'warn',
      code: 'fragrance-generic',
      text: '“Parfum/Fragrance” does not disclose its complete composition; no safety conclusion is inferred.',
    });
  }
  const unknownCount = assessments.filter((item) => !item.matched).length;
  // Raw unknown names are response/reporting inputs, not evidence. Keep that
  // privacy-sensitive list bounded while reporting the complete count.
  const unknown = assessments.filter((item) => !item.matched).map((item) => item.raw).slice(0, 20);
  if (unknownCount > 0) {
    flags.push({
      level: 'info',
      code: 'unknown-ingredients',
      text: `${unknownCount} of ${total} label entr${total === 1 ? 'y is' : 'ies are'} not identified by the local glossary or attributed external evidence.`,
    });
  }
  if (score === null) {
    flags.push({
      level: 'info',
      code: scoreStatus,
      text: 'The numeric score is withheld because the available identity/context evidence is not sufficient for a supported formula-level assessment.',
    });
  } else if (scoreStatus === 'available-with-unresolved-conditions') {
    flags.push({
      level: 'info',
      code: 'available-with-unresolved-conditions',
      text: 'The numeric score is shown with unresolved EU use conditions (concentration, product type, warnings). Conditions that cannot be read from a label are not resolved and are not treated as compliant.',
    });
  }

  const dataset = loadCosingDataset();
  return {
    label,
    form,
    formSource,
    ingredients: assessments,
    total,
    recognized: recognized.length,
    localRecognized: localRecognized.length,
    externallyIdentified: externallyIdentified.length,
    coverage: Math.round(coverage * 1000) / 1000,
    assessed: assessed.length,
    assessmentCoverage: Math.round(assessmentCoverage * 1000) / 1000,
    score,
    scoreStatus,
    confidence: confidenceFor(coverage, hasUnknownConditions),
    band: score === null ? null : bandFor(score),
    worstTier,
    unknownIngredients: unknown,
    flags,
    parser,
    ...(cappedReason ? { cappedReason } : {}),
    ...(opts?.vendorEvidence && opts.vendorEvidence.size > 0 ? { vendorEnriched: true } : {}),
    dataset: {
      rows: dataset.meta.rows,
      inventoryRows: dataset.meta.inventoryRows,
      glossaryRows: dataset.meta.glossaryRows,
      snapshot: dataset.meta.snapshot,
      version: `${dataset.meta.version}+${REGULATORY_DATASET_VERSION}`,
      regulationAsOf: EU_REGULATION_AS_OF,
      engineVersion: INGREDIENT_ENGINE_VERSION,
    },
    assessedAt: opts?.assessedAt ?? INGREDIENT_ENGINE_RELEASED_AT,
  };
}

export function analyzeInciText(text: string, opts?: AnalyzeOptions): AnalyzeResult {
  if (text.trim().length > MAX_INGREDIENT_TEXT_LENGTH) {
    throw new RangeError('ingredient text is too long');
  }
  const parsed = parseInciList(text);
  return analyzePrepared({
    ingredients: parsed.tokens,
    parserDiagnostics: parsed.diagnostics,
    parserValid: parsed.valid,
  }, opts);
}

export function analyzeIngredientList(ingredients: string[], opts?: AnalyzeOptions): AnalyzeResult {
  if (
    ingredients.length > 300
    || ingredients.some((item) => typeof item !== 'string' || item.trim().length > 500)
    || ingredients.reduce((length, item) => length + item.trim().length, 0)
      + Math.max(0, ingredients.length - 1) * 2 > MAX_INGREDIENT_TEXT_LENGTH
  ) throw new RangeError('ingredient list is too long');
  return analyzePrepared({ ingredients, parserDiagnostics: [], parserValid: true }, opts);
}
