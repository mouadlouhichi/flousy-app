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
import { strongerTier } from './types';
import { loadCosingDataset, lookupIngredient } from './dataset';
import { lookupOverlay } from './eu-lists';
import { normalizeInciToken, parseInciList } from './normalize';
import {
  EU_REGULATION_AS_OF,
  lookupRegulatorySignals,
  REGULATORY_DATASET_VERSION,
} from './regulatory';

export const INGREDIENT_ENGINE_VERSION = 'ingredient-evidence-v2';
export const INGREDIENT_ENGINE_RELEASED_AT = '2026-09-08T00:00:00.000Z';

const DEDUCTION: Record<RiskTier, number> = {
  prohibited: 100,
  restricted: 45,
  caution: 22,
  watch: 10,
  clean: 0,
};
const MIN_ASSESSMENT_COVERAGE = 0.8;
const PROHIBITED_CAP = 35;

const LEAVE_ON_PATTERNS = [
  /\bleave[ -]?in\b/iu,
  /\bafter[ -]?shave\b/iu,
  /\bsans rincage\b/iu,
  /\bcreme\b/iu,
  /\bcream\b/iu,
  /\blotion\b/iu,
  /\bserum\b/iu,
  /\bmoistur/iu,
  /\bsunscreens?\b|\bspf\b|\bsun protection\b/iu,
  /\bdeodorant\b|\bantiperspirant\b/iu,
  /\bfoundation\b|\bmakeup\b|\blip(?:stick| balm)\b|\bprimer\b|\btoner\b/iu,
  /\bperfume\b|\beau de\b|\bbalm\b|\bointment\b|\bstick\b|\bbutter\b/iu,
  /كريم|مرطب|مصل|واقي شمس|مزيل العرق|بلسم شفاه/u,
];
const RINSE_OFF_PATTERNS = [
  /\bshampoo(?:ing|s)?\b/iu,
  /\bshower\b|\bbody wash(?:es)?\b|\bface wash(?:es)?\b/iu,
  /\bsoap\b|\bsavons?\b/iu,
  /\bcleanser\b|\bcleansing\b|\bnettoyant\b/iu,
  /\bbath\b|\bdouche\b|\bscrub\b|\bexfoliat/iu,
  /\btoothpaste\b|\bdentifrice\b/iu,
  /\bhair conditioner\b|\bapres[- ]shampooing\b/iu,
  /\brinse[ -]?off\b|\ba rincer\b/iu,
  /شامبو|صابون|غسول|منظف|معجون اسنان|يشطف/u,
];

export function inferProductForm(category?: string, name?: string): ProductForm {
  const haystack = `${category ?? ''} ${name ?? ''}`
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
  // Explicit leave-on phrases must outrank generic words such as conditioner
  // and shave ("leave-in conditioner", "after-shave balm").
  if (LEAVE_ON_PATTERNS.some((pattern) => pattern.test(haystack))) return 'leave-on';
  if (RINSE_OFF_PATTERNS.some((pattern) => pattern.test(haystack))) return 'rinse-off';
  return 'unknown';
}

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

function confidenceFor(coverage: number): ProductAssessment['confidence'] {
  if (coverage >= 0.9) return 'full';
  if (coverage >= 0.6) return 'partial';
  return 'limited';
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
  assessmentCoverage: number;
  hasUnknownConditions: boolean;
}): ScoreStatus {
  if (input.total === 0) return 'withheld-no-ingredients';
  if (!input.parser.valid) return 'withheld-invalid-parse';
  if (input.parser.source === 'ocr' && !input.parser.reviewed) return 'withheld-review-required';
  if (input.form === 'unknown') return 'withheld-form-unknown';
  if (input.hasUnknownConditions) return 'withheld-conditions-unknown';
  if (input.assessmentCoverage < MIN_ASSESSMENT_COVERAGE) return 'withheld-insufficient-evidence';
  return 'available';
}

function analyzePrepared(input: AnalysisInput, opts?: AnalyzeOptions): AnalyzeResult {
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
  const scoreStatus = scoreStatusFor({
    total,
    parser,
    form,
    assessmentCoverage,
    hasUnknownConditions,
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
    deductionTotal += deduction;
  }

  let score: number | null = null;
  if (scoreStatus === 'available') {
    score = Math.max(0, 100 - deductionTotal);
    if (hasUnconditionalProhibited) score = Math.min(score, PROHIBITED_CAP);
  }

  const worstTier = assessments.reduce<RiskTier | null>(
    (current, item) => strongerTier(current, item.tier),
    null,
  );
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
  const unknown = assessments.filter((item) => !item.matched).map((item) => item.raw).slice(0, 20);
  if (unknown.length > 0) {
    flags.push({
      level: 'info',
      code: 'unknown-ingredients',
      text: `${unknown.length} of ${total} label entr${total === 1 ? 'y is' : 'ies are'} not identified by the local glossary or attributed external evidence.`,
    });
  }
  if (scoreStatus !== 'available') {
    flags.push({
      level: 'info',
      code: scoreStatus,
      text: 'The numeric score is withheld because the available identity/context evidence is not sufficient for a supported formula-level assessment.',
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
    confidence: confidenceFor(assessmentCoverage),
    band: score === null ? null : bandFor(score),
    worstTier,
    unknownIngredients: unknown,
    flags,
    parser,
    ...(hasUnconditionalProhibited ? { cappedReason: 'eu-annex-ii-name-match' } : {}),
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
  const parsed = parseInciList(text);
  return analyzePrepared({
    ingredients: parsed.tokens,
    parserDiagnostics: parsed.diagnostics,
    parserValid: parsed.valid,
  }, opts);
}

export function analyzeIngredientList(ingredients: string[], opts?: AnalyzeOptions): AnalyzeResult {
  return analyzePrepared({ ingredients, parserDiagnostics: [], parserValid: true }, opts);
}
