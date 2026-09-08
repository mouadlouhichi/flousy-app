/**
 * Structured, dated EU cosmetics annex evidence.
 *
 * The source file is an export of Annexes II–VI current to 2026-05-26. Exact
 * INCI/glossary names are indexed; chemical prose is never fuzzy-matched.
 * Conditions are preserved verbatim and unresolved conditions never become a
 * compliance verdict.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProductForm, RegulatoryCondition, RiskTier, Signal } from './types';
import { normalizeInciToken } from './normalize';

const DATA_PATH =
  process.env.EU_COSMETICS_ANNEX_PATH ??
  join(process.cwd(), 'data', 'cosing', 'eu-cosmetics-annexes-2026-05-26.json');

export const EU_REGULATION_SOURCE_URL =
  'https://eur-lex.europa.eu/eli/reg/2009/1223/2026-05-18/eng';
export const EU_REGULATION_AS_OF = '2026-05-26';
export const REGULATORY_DATASET_VERSION = 'eu-cosmetics-annexes-2026-05-26-v1';

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
  let payload: RawPayload;
  try {
    payload = JSON.parse(readFileSync(DATA_PATH, 'utf8')) as RawPayload;
  } catch (error) {
    throw new Error(`EU cosmetics annex dataset not found or invalid at ${DATA_PATH} (${(error as Error).message})`);
  }
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
  const applicability = isUnconditionalAnnexTwo ? 'applies' : 'conditions-unknown';
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

  let tier: RiskTier = 'restricted';
  if (isUnconditionalAnnexTwo) tier = 'prohibited';
  else if (positiveList) tier = 'restricted';

  const annexLabel = `EU Cosmetics Annex ${record.annex}, entry ${record.entry}`;
  const label = isUnconditionalAnnexTwo
    ? 'Exact name match in the EU Annex II prohibited list'
    : positiveList
      ? 'EU positive-list entry with conditions'
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
