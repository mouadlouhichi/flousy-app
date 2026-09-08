/**
 * INCI analysis + product scoring (deterministic, data-driven).
 *
 * Scoring model (documented in depth in docs/COSMETIC_INGREDIENT_SCORING.md):
 *
 * 1. Each recognized ingredient is classified into a risk tier from its
 *    signals (CosIng annex references + the versioned EU overlay).
 * 2. Each tier carries a fixed deduction: prohibited 100 · restricted 45 ·
 *    caution 22 · watch 10 · clean 0. Legal signals (Annex II/III and the
 *    EU-restricted overlay) apply at full weight wherever the ingredient sits;
 *    comfort flags (caution/watch) are scaled by label order — INCI lists are
 *    descending concentration, so a top-listed drying alcohol or fragrance
 *    costs more than a trace at the tail.
 * 3. Product score = 100 − Σ deductions, blended toward the neutral 78 as
 *    coverage drops (unrecognized names are "unknown" — never "clean", never
 *    punished, but they reduce how much of the list could be evaluated).
 * 4. A recognized EU-prohibited ingredient hard-caps the score at 35 / avoid.
 * 5. Form context: comedogenicity, drying-alcohol and sulfate flags only apply
 *    to leave-on (unknown is scored conservatively as leave-on). Fragrance
 *    allergens and leave-on-restricted preservatives drop to "watch" in
 *    rinse-off products, mirroring the EU's 10× higher rinse-off labelling
 *    threshold.
 *
 * Everything is a pure function of the label text + options: same input →
 * same output, so scores are reproducible and auditable.
 */

import type {
  Band,
  IngredientAssessment,
  ProductAssessment,
  ProductFlag,
  ProductForm,
  RiskTier,
  Signal,
  TierSource,
} from './types';
import { strongerTier } from './types';
import { loadCosingDataset, lookupIngredient } from './dataset';
import { lookupOverlay } from './eu-lists';
import { normalizeInciToken, splitInciList } from './normalize';

/** Fixed deduction per tier (see header comment + design doc). */
const DEDUCTION: Record<RiskTier, number> = {
  prohibited: 100,
  restricted: 45,
  caution: 22,
  watch: 10,
  clean: 0,
};

/** Neutral reference used to blend scores when coverage is incomplete. */
const NEUTRAL_SCORE = 78;
/** Hard cap when an EU-prohibited ingredient is recognized. */
const PROHIBITED_CAP = 35;

const RINSE_OFF_MARKERS = [
  'shampoo',
  'shower',
  'wash',
  'soap',
  'cleanser',
  'cleansing',
  'bath',
  'douche',
  'scrub',
  'exfoliat',
  'toothpaste',
  'dentifrice',
  'conditioner',
  'shave',
  'rinse',
];
const LEAVE_ON_MARKERS = [
  'cream',
  'lotion',
  'serum',
  'moistur',
  'sunscreen',
  'sun protection',
  'spf',
  'deodorant',
  'antiperspirant',
  'foundation',
  'makeup',
  'lipstick',
  'lip balm',
  'primer',
  'toner',
  'perfume',
  'eau de',
  'mist',
  'balm',
  'ointment',
  'stick',
  'butter',
  'oil',
];

export function inferProductForm(category?: string, name?: string): ProductForm {
  const hay = `${category ?? ''} ${name ?? ''}`.toLowerCase();
  if (RINSE_OFF_MARKERS.some((m) => hay.includes(m))) return 'rinse-off';
  if (LEAVE_ON_MARKERS.some((m) => hay.includes(m))) return 'leave-on';
  return 'unknown';
}

export interface AnalyzeOptions {
  /** Expected use: leave-on | rinse-off | unknown (unknown scores like leave-on). */
  form?: ProductForm;
  /** Product label, echoed back and used for form inference when form is unknown. */
  label?: string;
  /** OBF-style category ("Shampoos", "Moisturizers"…), used for form inference. */
  category?: string;
  /**
   * Optional external-database recognitions (normalized INCI name → info),
   * applied ONLY to names the local snapshot could not match. The server route
   * injects these when a key-gated vendor reports the name as safe — a third
   * party can add coverage, never a penalty or a non-clean bill of health.
   */
  vendorRecognized?: ReadonlyMap<string, { label: string; detail: string; evidence: string[] }>;
}

export interface AnalyzeResult extends ProductAssessment {}

function pushSignal(target: Signal[], signal: Signal): void {
  if (!target.some((s) => s.code === signal.code)) target.push(signal);
}

/** An informational annotation that carries no penalty. */
function note(code: string, label: string, detail: string, evidence: string[]): Signal {
  return { code, tier: 'clean', label, detail, evidence };
}

const ANNEX_LABEL: Record<string, string> = {
  II: 'Listed in CosIng restriction text under Annex II (prohibited list)',
  III: 'EU-restricted ingredient (Annex III conditions in CosIng)',
  IV: 'EU-approved colorant list (Annex IV)',
  V: 'EU-approved preservative list (Annex V)',
  VI: 'EU-approved UV-filter list (Annex VI)',
};

const ANNEX_DETAIL: Record<string, string> = {
  II: 'CosIng restriction text references Annex II (prohibited substances).',
  III: 'CosIng restriction text references Annex III (restricted substances with conditions).',
};

function assessIngredient(
  raw: string,
  index: number,
  form: ProductForm,
  vendorRecognized?: ReadonlyMap<string, { label: string; detail: string; evidence: string[] }>,
): IngredientAssessment {
  const normalized = normalizeInciToken(raw);
  const base: IngredientAssessment = { index, raw, normalized, matched: false, signals: [], tier: null };
  if (!normalized) return base;

  const lookup = lookupIngredient(raw);
  const record = lookup.record;
  const signals: Signal[] = [];

  if (record) {
    base.matched = true;
    base.matchedInci = record.inci;
    base.cas = record.cas;
    base.functions = record.functions;
    base.restrictionText = record.restrictionText;
    const annexes = new Set(record.annexCodes.map((c) => c.annex));
    for (const annex of ['II', 'III', 'IV', 'V', 'VI']) {
      if (!annexes.has(annex)) continue;
      if (annex === 'II' || annex === 'III') {
        const entries = record.annexCodes
          .filter((c) => c.annex === annex)
          .map((c) => c.entry ?? '')
          .filter(Boolean);
        const dedupe = [...new Set(entries)];
        pushSignal(signals, {
          code: `cosing-annex-${annex}`,
          tier: annex === 'II' ? 'prohibited' : 'restricted',
          label: ANNEX_LABEL[annex],
          detail: dedupe.length
            ? `${ANNEX_DETAIL[annex]} Entries: ${dedupe.join(', ')}.`
            : ANNEX_DETAIL[annex],
          evidence: ['CosIng inventory snapshot restriction column', 'Reg (EC) No 1223/2009'],
        });
      } else {
        pushSignal(
          signals,
          note(
            'cosing-approved-annex',
            ANNEX_LABEL[annex],
            'Present on an EU positive list with use conditions (informational).',
            ['CosIng inventory snapshot restriction column'],
          ),
        );
      }
    }
  }

  // Overlay signals — searched on the label key and on the canonical key the
  // ingredient resolved to (aliases + parenthetical stripping).
  const overlayKeys = new Set<string>([normalized]);
  if (lookup.via !== 'exact' && record) overlayKeys.add(normalizeInciToken(record.inci));
  const overlayHits = new Map<string, Signal>();
  for (const key of overlayKeys) {
    for (const hit of lookupOverlay(key)) {
      if (!overlayHits.has(hit.signal.code)) overlayHits.set(hit.signal.code, hit.signal);
    }
  }
  for (const signal of overlayHits.values()) pushSignal(signals, signal);

  // When an ingredient is an EU fragrance allergen, its own Annex III entry is
  // the labelling/conditions entry — do not double-count it as an independent
  // second restriction (the allergen signal already carries the flag).
  const hasAllergenSignal = signals.some((s) => s.code === 'eu-fragrance-allergen');
  if (hasAllergenSignal) {
    for (let i = signals.length - 1; i >= 0; i -= 1) {
      if (signals[i].code === 'cosing-annex-III') signals.splice(i, 1);
    }
  }
  const prohibited = signals.some((s) => s.tier === 'prohibited');

  // Rinse-off context: leave-on-only flags are not applicable; allergens and
  // leave-on-restricted preservatives drop one tier (EU treats rinse-off
  // exposure as 10× lower — see the 0.001%/0.01% labelling thresholds).
  if (form === 'rinse-off') {
    const kept: Signal[] = [];
    for (const s of signals) {
      if (s.leaveOnOnly) continue;
      if (s.code === 'eu-fragrance-allergen' && !prohibited) {
        kept.push({ ...s, tier: 'watch' });
        continue;
      }
      if (s.code === 'eu-restricted') {
        kept.push({ ...s, tier: 'watch' }); // MIT / MCI / retinol caps are leave-on caps
        continue;
      }
      kept.push(s);
    }
    signals.length = 0;
    signals.push(...kept);
  }

  let tier: RiskTier | null = null;
  let tierSource: TierSource | undefined;
  for (const s of signals) {
    if (s.code === 'cosing-approved-annex') continue;
    const candidate = strongerTier(tier, s.tier);
    if (candidate !== tier) tierSource = s.code.startsWith('cosing') ? 'cosing' : 'eu-overlay';
    tier = candidate;
  }
  if (tier === null && record) {
    tier = 'clean';
    tierSource = 'cosing';
  }

  // Vendor coverage enrichment: names the local snapshot does not match may be
  // recognized as 'clean' by a key-gated external database. The injected map
  // only ever carries safe verdicts, so this raises coverage without ever
  // introducing a third-party penalty.
  if (tier === null && !record && vendorRecognized) {
    const vendor = vendorRecognized.get(normalized);
    if (vendor) {
      base.matched = true;
      base.matchedInci = vendor.label;
      pushSignal(signals, {
        code: 'vendor-analyze',
        tier: 'clean',
        label: vendor.label,
        detail: vendor.detail,
        evidence: vendor.evidence,
      });
      tier = 'clean';
      tierSource = 'vendor';
    }
  }

  base.signals = signals;
  base.tier = tier;
  base.tierSource = tierSource;
  return base;
}

/** Label-order exposure weight: first INCI entry ~1, last ~0.3. */
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

function confidenceFor(coverage: number): 'full' | 'partial' | 'limited' {
  if (coverage >= 0.9) return 'full';
  if (coverage >= 0.6) return 'partial';
  return 'limited';
}

export function analyzeInciText(text: string, opts?: AnalyzeOptions): AnalyzeResult {
  return analyzeIngredientList(splitInciList(text), opts);
}

export function analyzeIngredientList(
  ingredients: string[],
  opts?: AnalyzeOptions,
): AnalyzeResult {
  const cleaned = ingredients
    .map((t) => String(t).trim())
    .filter((t) => t.length > 0);
  const total = cleaned.length;
  const label = opts?.label?.trim() || undefined;
  const category = opts?.category?.trim() || undefined;
  const requestedForm = opts?.form ?? inferProductForm(category, label);
  // Unknown form → conservative leave-on treatment (mirrors EU thresholds).
  const effectiveForm: ProductForm = requestedForm === 'rinse-off' ? 'rinse-off' : 'leave-on';

  const assessments = cleaned.map((raw, i) =>
    assessIngredient(raw, i, effectiveForm, opts?.vendorRecognized),
  );
  const recognized = assessments.filter((a) => a.tier !== null);
  const coverage = total === 0 ? 0 : recognized.length / total;

  // --- aggregate score (deduction model) ------------------------------------
  let deductionTotal = 0;
  let penalizedProhibited = false;
  for (const a of assessments) {
    const tier = a.tier;
    if (!tier) continue;
    let penalty = DEDUCTION[tier];
    if (penalty === 0) {
      a.subScore = 100;
      continue;
    }
    if (tier === 'prohibited') penalizedProhibited = true;
    // Comfort flags scale with label order; legal signals are full-weight.
    const weight =
      tier === 'prohibited' || tier === 'restricted' ? 1 : exposureWeight(a.index, total);
    const deduction = Math.round(penalty * weight);
    deductionTotal += deduction;
    a.subScore = Math.max(0, Math.min(100, 100 - deduction));
  }

  let score: number | null = null;
  if (recognized.length > 0) {
    const rawScore = Math.max(0, 100 - deductionTotal);
    const blend = Math.min(1, Math.max(0, (coverage - 0.25) / 0.65));
    score = Math.round(rawScore * blend + NEUTRAL_SCORE * (1 - blend));
    // Confidence caps: an incomplete list must never read "excellent" (or even
    // "good") as if the whole formula had been evaluated.
    if (coverage < 0.6) score = Math.min(score, 64); // moderate at most
    else if (coverage < 0.9) score = Math.min(score, 84); // good at most
    if (penalizedProhibited) score = Math.min(score, PROHIBITED_CAP);
  }

  const worstTier = assessments.reduce<RiskTier | null>((acc, a) => strongerTier(acc, a.tier), null);

  // --- product flags ---------------------------------------------------------
  const flags: ProductFlag[] = [];
  const prohibited = assessments.filter((a) => a.tier === 'prohibited');
  if (prohibited.length > 0) {
    flags.push({
      level: 'error',
      code: 'contains-prohibited',
      text: `Contains ${prohibited.length === 1 ? 'an ingredient' : 'ingredients'} prohibited in EU cosmetics: ${prohibited
        .map((p) => p.matchedInci ?? p.raw)
        .join(', ')}.`,
    });
  }
  const allergens = assessments.filter((a) =>
    a.signals.some((s) => s.code === 'eu-fragrance-allergen'),
  );
  if (allergens.length > 0) {
    const names = allergens.map((a) => a.matchedInci ?? a.raw);
    flags.push({
      level: 'warn',
      code: 'fragrance-allergens',
      text: `${names.length} EU-declarable fragrance allergen${names.length === 1 ? '' : 's'}: ${names
        .slice(0, 3)
        .join(', ')}${names.length > 3 ? ` +${names.length - 3} more` : ''}.`,
    });
  }
  const restricted = assessments.filter((a) => a.tier === 'restricted');
  if (restricted.length > 0) {
    flags.push({
      level: 'warn',
      code: 'eu-restricted-ingredients',
      text: `EU-restricted ingredient${restricted.length === 1 ? '' : 's'}: ${restricted
        .map((r) => r.matchedInci ?? r.raw)
        .join(', ')} — see per-ingredient details.`,
    });
  }
  const genericFragrance = assessments.find((a) =>
    a.signals.some((s) => s.code === 'fragrance-generic'),
  );
  if (genericFragrance) {
    flags.push({
      level: 'warn',
      code: 'fragrance-generic',
      text: 'Contains "Parfum/Fragrance" — the composition is not declared; relevant for fragrance-sensitive skin.',
    });
  }
  const releasers = assessments.filter((a) =>
    a.signals.some((s) => s.code === 'formaldehyde-releaser'),
  );
  if (releasers.length > 0) {
    flags.push({
      level: 'warn',
      code: 'formaldehyde-releasers',
      text: `Contains formaldehyde releaser${releasers.length === 1 ? '' : 's'}: ${releasers
        .map((r) => r.matchedInci ?? r.raw)
        .join(', ')}.`,
    });
  }
  const unknown = assessments.filter((a) => a.tier === null).map((a) => a.raw).slice(0, 8);
  if (unknown.length > 0) {
    flags.push({
      level: 'info',
      code: 'unknown-ingredients',
      text: `${unknown.length} of ${total} ingredient${total === 1 ? '' : 's'} not found in the local database: ${unknown.join(', ')}.`,
    });
  }

  // The loader is cached — this read happens once per process; a missing
  // dataset raises here and the API route maps it to a clear 503.
  const ds = loadCosingDataset();

  return {
    label,
    form: requestedForm,
    ingredients: assessments,
    total,
    recognized: recognized.length,
    coverage: Math.round(coverage * 1000) / 1000,
    score,
    confidence: score === null ? 'limited' : confidenceFor(coverage),
    band: score === null ? null : bandFor(score),
    worstTier,
    unknownIngredients: unknown,
    flags,
    ...(penalizedProhibited ? { cappedReason: 'prohibited-ingredient' } : {}),
    dataset: { rows: ds.meta.rows, snapshot: ds.meta.snapshot, version: ds.meta.version },
  };
}
