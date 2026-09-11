/**
 * Structured, dated EU cosmetics annex evidence.
 *
 * The source file is an export of Annexes II–VI current to 2026-05-26. Exact
 * INCI/glossary names are indexed; chemical prose is never fuzzy-matched.
 * Conditions are preserved verbatim and unresolved conditions never become a
 * compliance verdict.
 */

import bundledAnnexPayload from '../../../data/cosing/eu-cosmetics-annexes-2026-05-26.json';
import type { ProductForm, RegulatoryCondition, RiskTier, Signal } from './types';
import { normalizeInciToken } from './normalize';
import { REGULATORY_DATASET_VERSION } from './version';

export { REGULATORY_DATASET_VERSION } from './version';
export const EU_REGULATION_SOURCE_URL =
  'https://eur-lex.europa.eu/eli/reg/2009/1223/2026-05-18/eng';
export const EU_REGULATION_AS_OF = '2026-05-26';

interface RawAnnexRecord {
  annex: 'II' | 'III' | 'IV' | 'V' | 'VI';
  entry: string;
  chemicalName?: string;
  glossaryNames?: string;
  identifiedIngredients?: string;
  casNumbers?: string;
  ecNumbers?: string;
  productType?: string;
  maxConcentration?: string;
  otherRestrictions?: string;
  warnings?: string;
  regulation?: string;
  cmr?: string;
  updateDate?: string;
}

interface RawPayload {
  schemaVersion: number;
  records: RawAnnexRecord[];
}

interface RegulatoryDataset {
  records: number;
  byName: ReadonlyMap<string, readonly RawAnnexRecord[]>;
}

let cache: RegulatoryDataset | null = null;

function namesFrom(record: RawAnnexRecord): string[] {
  const names = new Set<string>();
  const add = (value: string) => {
    const cleaned = value.trim().replace(/^[-–—]+$/u, '');
    if (cleaned && /\p{L}|\d/u.test(cleaned)) names.add(cleaned);
  };

  // This field is emitted by CosIng specifically to link annex substances to
  // ingredient identities. Commas delimit records in the export.
  for (const value of (record.identifiedIngredients ?? '').split(',')) add(value);

  const glossary = record.glossaryNames ?? '';
  if (glossary) {
    add(glossary);
    for (const semicolonPart of glossary.split(';')) {
      add(semicolonPart);
      // CosIng uses spaced slashes for many explicit name lists. Composite
      // ingredient names without surrounding spaces stay intact.
      for (const slashPart of semicolonPart.split(/\s+\/\s+/u)) add(slashPart);
    }
  }

  // A small number of Annex II rows state an INCI name only inside brackets.
  for (const match of (record.chemicalName ?? '').matchAll(/\bINCI\s*:\s*([^;\]\n]+)/giu)) {
    add(match[1]);
  }
  return [...names];
}

function loadRegulatoryDataset(): RegulatoryDataset {
  if (cache) return cache;
  // Static import keeps Next.js file tracing scoped to this committed corpus;
  // a dynamic filesystem path would pull the whole project into the route.
  const payload = bundledAnnexPayload as unknown as RawPayload;
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.records)) {
    throw new Error('EU cosmetics annex dataset schema is unsupported');
  }
  const index = new Map<string, RawAnnexRecord[]>();
  for (const record of payload.records) {
    for (const name of namesFrom(record)) {
      const key = normalizeInciToken(name);
      if (!key) continue;
      const existing = index.get(key) ?? [];
      if (!existing.some((item) => item.annex === record.annex && item.entry === record.entry)) {
        existing.push(record);
        index.set(key, existing);
      }
    }
  }
  cache = { records: payload.records.length, byName: index };
  return cache;
}

function annexTwoHasConditions(record: RawAnnexRecord): boolean {
  const text = `${record.chemicalName ?? ''} ${record.productType ?? ''} ${record.maxConcentration ?? ''} ${record.otherRestrictions ?? ''}`;
  return /\b(?:EXCEPT|EXCEPTION|WHEN USED|UNLESS|NORMAL CONTENT|BELOW\s+\d|WITH THE EXCEPTION)\b/iu.test(text);
}

/** Use-context wording that appears in the exported `productType` / concentration
 * fields of Annexes IV–VI (the positive lists). Matched only against the
 * record's own words, never against a guessed product category. */
const RINSE_OFF_USE =
  /\b(?:rinse[-\s]?off|rincer|shower|shampo\w*|soaps?|savon|toothpaste|dentifrice|mouthwash)\b/iu;
const LEAVE_ON_USE = /\b(?:leave[-\s]?on|sans\s+rincage|sans\s+rinçage|non[-\s]?rinse)\b/iu;

/**
 * Detect an explicit form conflict for a POSITIVE-LIST entry.
 *
 * Annexes IV–VI authorise a substance for named uses at named
 * concentrations. When the record's own wording covers only the opposite
 * exposure context from the one the user selected, the annex does not
 * authorise this use — that is a resolvable fact, not an unknown one
 * (e.g. methylisothiazolinone: Annex V/57 is a rinse-off-only entry, so a
 * leave-on declaration is not covered by it).
 *
 * Returns 'none' whenever the record does not state a use context, or when it
 * mentions both contexts, or when the form is unknown. Those cases stay
 * `conditions-unknown` and never become a verdict.
 */
export type PositiveListFormConflict = 'none' | 'rinse-off-only' | 'leave-on-only';

export function positiveListFormConflict(
  record: Pick<RawAnnexRecord, 'productType' | 'maxConcentration' | 'otherRestrictions'>,
  form: ProductForm,
): PositiveListFormConflict {
  if (form === 'unknown') return 'none';
  const text = `${record.productType ?? ''} ${record.maxConcentration ?? ''} ${record.otherRestrictions ?? ''}`;
  if (!text.trim()) return 'none';
  const rinseOff = RINSE_OFF_USE.test(text);
  const leaveOn = LEAVE_ON_USE.test(text);
  if (form === 'leave-on' && rinseOff && !leaveOn) return 'rinse-off-only';
  if (form === 'rinse-off' && leaveOn && !rinseOff) return 'leave-on-only';
  return 'none';
}

function contextNote(record: RawAnnexRecord, form: ProductForm, category?: string): string {
  const productType = record.productType?.trim();
  const knownContext = [form !== 'unknown' ? form : '', category?.trim() ?? ''].filter(Boolean).join(', ');
  if (productType) {
    return `Listed product/use conditions: ${productType}.${knownContext ? ` Supplied context: ${knownContext}.` : ''} Concentration and full intended-use facts are not available from the ingredient list.`;
  }
  if (record.maxConcentration) {
    return 'The annex sets a concentration condition, but label order does not provide concentration.';
  }
  return 'The ingredient list does not establish concentration, purity, warnings, professional use, body site, age group, or other formulation conditions.';
}

function toSignal(record: RawAnnexRecord, form: ProductForm, category?: string): Signal {
  const conditionalAnnexTwo = record.annex === 'II' && annexTwoHasConditions(record);
  const isUnconditionalAnnexTwo = record.annex === 'II' && !conditionalAnnexTwo;
  const positiveList = record.annex === 'IV' || record.annex === 'V' || record.annex === 'VI';
  const formConflict = positiveList ? positiveListFormConflict(record, form) : 'none';
  // A positive-list entry whose own wording covers only the opposite exposure
  // context is a resolved non-authorisation for the selected form; every other
  // conditional record remains unresolved.
  const applicability = isUnconditionalAnnexTwo || formConflict !== 'none'
    ? 'applies'
    : 'conditions-unknown';
  const legalRole: RegulatoryCondition['legalRole'] = isUnconditionalAnnexTwo
    ? 'prohibited-list'
    : record.annex === 'II' || record.annex === 'III'
      ? 'restricted-list'
      : 'positive-list-with-conditions';
  const condition: RegulatoryCondition = {
    jurisdiction: 'EU',
    framework: 'Regulation (EC) No 1223/2009',
    annex: record.annex,
    entry: record.entry,
    legalRole,
    applicability,
    applicabilityReason: isUnconditionalAnnexTwo
      ? 'The exact ingredient name matches an Annex II record without an exception in the exported record.'
      : formConflict !== 'none'
        ? `The dated annex authorises this substance for ${formConflict === 'rinse-off-only' ? 'rinse-off' : 'leave-on'} uses only, and the selected product form is ${form}. Verify the product type and the official entry — an ingredient list does not establish the formulation's compliance.`
        : contextNote(record, form, category),
    ...(record.productType ? { productType: record.productType } : {}),
    ...(record.maxConcentration ? { maxConcentration: record.maxConcentration } : {}),
    ...(record.otherRestrictions ? { otherRestrictions: record.otherRestrictions } : {}),
    ...(record.warnings ? { warnings: record.warnings } : {}),
    ...(record.regulation ? { regulation: record.regulation } : {}),
    effectiveAsOf: EU_REGULATION_AS_OF,
    sourceUpdated: EU_REGULATION_AS_OF,
    sourceUrl: EU_REGULATION_SOURCE_URL,
  };

  // Positive lists (Annexes IV–VI) authorise a substance subject to
  // conditions: presence on the label is therefore an informational "authorised
  // substance, conditions not shown on the label" signal (watch), not a
  // restriction-level concern. The one exception is a resolved form conflict,
  // where the annex does not cover the use the user selected.
  let tier: RiskTier = 'restricted';
  if (isUnconditionalAnnexTwo) tier = 'prohibited';
  else if (positiveList) tier = formConflict !== 'none' ? 'restricted' : 'watch';

  const annexLabel = `EU Cosmetics Annex ${record.annex}, entry ${record.entry}`;
  const label = isUnconditionalAnnexTwo
    ? 'Exact name match in the EU Annex II prohibited list'
    : formConflict !== 'none'
      ? 'EU positive-list entry that does not cover the selected product form'
      : positiveList
        ? 'EU positive-list entry — authorised substance, conditions not shown on the label'
        : 'EU annex entry with unresolved conditions';
  const details = [
    condition.applicabilityReason,
    record.maxConcentration ? `Maximum concentration field: ${record.maxConcentration}` : '',
    record.otherRestrictions ? `Other conditions: ${record.otherRestrictions}` : '',
    record.warnings ? `Required warning field: ${record.warnings}` : '',
  ].filter(Boolean);

  return {
    code: `eu-annex-${record.annex.toLowerCase()}-${record.entry}`,
    tier,
    kind: 'regulatory',
    label,
    detail: details.join(' '),
    applicability,
    evidence: [annexLabel, record.regulation ?? 'Regulation (EC) No 1223/2009'],
    references: [{
      title: annexLabel,
      url: EU_REGULATION_SOURCE_URL,
      sourceVersion: REGULATORY_DATASET_VERSION,
    }],
    regulatory: condition,
  };
}

/** Return structured exact-name regulatory evidence. */
export function lookupRegulatorySignals(
  normalizedName: string,
  context: { form: ProductForm; category?: string },
): Signal[] {
  const records = loadRegulatoryDataset().byName.get(normalizedName) ?? [];
  return records.map((record) => toSignal(record, context.form, context.category));
}

export function regulatoryDatasetStats(): { records: number; indexedNames: number; version: string } {
  const dataset = loadRegulatoryDataset();
  return {
    records: dataset.records,
    indexedNames: dataset.byName.size,
    version: REGULATORY_DATASET_VERSION,
  };
}

export function clearRegulatoryDatasetCache(): void {
  cache = null;
}
