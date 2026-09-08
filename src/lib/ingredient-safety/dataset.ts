/** Server-only ingredient identity dataset loader. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnnexCode, CosIngRecord } from './types';
import { normalizeInciToken, normalizeWithoutParens, resolveAlias } from './normalize';

export interface CosIngDataset {
  meta: {
    rows: number;
    inventoryRows: number;
    glossaryRows: number;
    snapshot: string;
    version: string;
    glossarySourceUrl: string;
  };
  byName: ReadonlyMap<string, CosIngRecord>;
  byStrippedName: ReadonlyMap<string, readonly CosIngRecord[]>;
  casByName: ReadonlyMap<string, string>;
}

const LEGACY_TSV_PATH =
  process.env.INGREDIENT_DB_PATH ?? join(process.cwd(), 'data', 'cosing', 'cosing-ingredients.tsv');
const GLOSSARY_TSV_PATH =
  process.env.INGREDIENT_GLOSSARY_PATH ??
  join(process.cwd(), 'data', 'cosing', 'eu-inci-glossary-2025.tsv');

/** Legacy references are retained as provenance only. They are intentionally
 * not consumed by the current legal assessment engine. */
const ANNEX_RE = /\b([IVX]{1,3})\s*\/\s*([A-Z]{0,2}\d+(?:-[A-Z0-9]+)*)/g;
const ALLOWED_ANNEXES = new Set(['II', 'III', 'IV', 'V', 'VI']);

function parseLegacyAnnexCodes(restriction: string | undefined): AnnexCode[] {
  if (!restriction) return [];
  const out: AnnexCode[] = [];
  for (const match of restriction.matchAll(ANNEX_RE)) {
    if (!ALLOWED_ANNEXES.has(match[1])) continue;
    out.push({ annex: match[1], entry: match[2] });
  }
  return out;
}

function splitFunctions(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw.split(',').map((part) => part.trim()).filter((part) => part && part !== 'NOT REPORTED');
  return parts.length > 0 ? parts : undefined;
}

function readRequired(path: string, label: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`${label} dataset not found at ${path} (${(error as Error).message})`);
  }
}

let cache: CosIngDataset | null = null;

export function loadCosingDataset(): CosIngDataset {
  if (cache) return cache;

  const byName = new Map<string, CosIngRecord>();
  const stripped = new Map<string, CosIngRecord[]>();
  const casByName = new Map<string, string>();
  let inventoryRows = 0;
  let glossaryRows = 0;

  const legacy = readRequired(LEGACY_TSV_PATH, 'CosIng inventory');
  for (const line of legacy.split('\n')) {
    if (!line) continue;
    const cells = line.split('\t');
    const inci = (cells[0] ?? '').trim();
    if (!inci || inci === 'inci' || cells.length < 2) continue;
    inventoryRows += 1;
    const cas = (cells[1] ?? '').trim() || undefined;
    const ec = (cells[2] ?? '').trim() || undefined;
    const restrictionText = (cells[4] ?? '').trim() || undefined;
    const record: CosIngRecord = {
      inci,
      cas,
      ec,
      functions: splitFunctions(cells[3]?.trim()),
      restrictionText,
      annexCodes: parseLegacyAnnexCodes(restrictionText),
      identitySource: 'legacy-inventory',
      legacyInventoryMatch: true,
    };
    const key = normalizeInciToken(inci);
    if (key && !byName.has(key)) byName.set(key, record);
    if (record.cas && !casByName.has(record.cas)) casByName.set(record.cas, record.inci);
  }

  const glossary = readRequired(GLOSSARY_TSV_PATH, 'EU 2025 INCI glossary');
  for (const line of glossary.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const entry = line.slice(0, tab).trim();
    const inci = line.slice(tab + 1).trim();
    if (!entry || entry === 'entry' || !inci) continue;
    glossaryRows += 1;
    const key = normalizeInciToken(inci);
    if (!key) continue;
    const existing = byName.get(key);
    if (existing) {
      byName.set(key, {
        ...existing,
        // The current official glossary is the primary identity authority;
        // older functions/CAS remain attributed legacy metadata.
        inci,
        identitySource: 'official-glossary',
        glossaryEntry: entry,
        glossaryName: inci,
        legacyInventoryMatch: true,
      });
    } else {
      byName.set(key, {
        inci,
        annexCodes: [],
        identitySource: 'official-glossary',
        glossaryEntry: entry,
        glossaryName: inci,
      });
    }
  }

  for (const record of byName.values()) {
    const key = normalizeInciToken(record.inci);
    const strippedKey = normalizeWithoutParens(record.inci);
    if (strippedKey && strippedKey !== key) {
      const list = stripped.get(strippedKey) ?? [];
      list.push(record);
      stripped.set(strippedKey, list);
    }
  }

  cache = {
    meta: {
      rows: byName.size,
      inventoryRows,
      glossaryRows,
      snapshot: 'EU glossary applies 2026-07-30; legacy CosIng metadata snapshot 2019-03-13',
      version: 'ingredient-identity-2025-1175-v1',
      glossarySourceUrl: 'https://eur-lex.europa.eu/eli/dec_impl/2025/1175/oj',
    },
    byName,
    byStrippedName: stripped,
    casByName,
  };
  return cache;
}

export interface IngredientLookup {
  record?: CosIngRecord;
  via: 'exact' | 'alias' | 'paren-stripped' | 'none';
}

export function lookupIngredient(raw: string): IngredientLookup {
  const dataset = loadCosingDataset();
  const key = normalizeInciToken(raw);
  if (!key) return { via: 'none' };

  const canonical = resolveAlias(key);
  if (canonical) {
    const aliased = dataset.byName.get(canonical);
    if (aliased) return { record: aliased, via: 'alias' };
  }

  const exact = dataset.byName.get(key);
  if (exact) return { record: exact, via: 'exact' };

  const strippedKey = normalizeWithoutParens(raw);
  if (strippedKey && strippedKey !== key) {
    const direct = dataset.byName.get(strippedKey);
    if (direct) return { record: direct, via: 'paren-stripped' };
    const candidates = dataset.byStrippedName.get(strippedKey);
    if (candidates?.length === 1) return { record: candidates[0], via: 'paren-stripped' };
  }

  return { via: 'none' };
}

export function lookupByCas(cas: string): CosIngRecord | undefined {
  const dataset = loadCosingDataset();
  const inci = dataset.casByName.get(cas.trim());
  return inci ? dataset.byName.get(normalizeInciToken(inci)) : undefined;
}

/** Test/maintenance hook for alternate dataset fixtures. */
export function clearCosingDatasetCache(): void {
  cache = null;
}
