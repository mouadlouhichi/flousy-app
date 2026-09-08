/**
 * Local CosIng dataset loader (server-only; uses node:fs).
 *
 * The committed snapshot lives at data/cosing/cosing-ingredients.tsv
 * (28,7xx rows, merged from the official EU "CosIng — Ingredients & Fragrance
 * Inventory" export mirrored on GitHub, snapshot 2019-03-13, + a 2024-era
 * identifier layer). Provenance, licensing and the refresh procedure are in
 * data/cosing/README.md and docs/COSMETIC_INGREDIENT_SCORING.md.
 *
 * This module is imported only by server code (the /api/inci/analyze route and
 * node tests). Nothing client-side ever loads it — the app's privacy stance
 * (only the barcode/INCI digits leave the device, and then only to the app's
 * own route) is preserved.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnnexCode, CosIngRecord } from './types';
import { normalizeInciToken, normalizeWithoutParens, resolveAlias } from './normalize';

export interface CosIngDataset {
  meta: { rows: number; snapshot: string; version: string };
  /** Exact normalized-name lookup. */
  byName: ReadonlyMap<string, CosIngRecord>;
  /** Name with parenthetical annotations stripped → candidates (rare). */
  byStrippedName: ReadonlyMap<string, readonly CosIngRecord[]>;
  casByName: ReadonlyMap<string, string>;
}

const TSV_PATH =
  process.env.INGREDIENT_DB_PATH ?? join(process.cwd(), 'data', 'cosing', 'cosing-ingredients.tsv');

const ANNEX_RE = /\b([IVX]{1,3})\s*\/\s*([A-Z]{0,2}\d+(?:-[A-Z0-9]+)*)/g;
const ALLOWED_ANNEXES = new Set(['II', 'III', 'IV', 'V', 'VI']);

function parseAnnexCodes(restriction: string | undefined): AnnexCode[] {
  if (!restriction) return [];
  const out: AnnexCode[] = [];
  for (const m of restriction.matchAll(ANNEX_RE)) {
    const annex = m[1];
    if (!ALLOWED_ANNEXES.has(annex)) continue;
    const entry = m[2];
    out.push({ annex, entry });
  }
  return out;
}

function splitFunctions(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && p !== 'NOT REPORTED');
  return parts.length ? parts : undefined;
}

let cache: CosIngDataset | null = null;

export function loadCosingDataset(): CosIngDataset {
  if (cache) return cache;

  let text: string;
  try {
    text = readFileSync(TSV_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      `CosIng dataset not found at ${TSV_PATH} — see data/cosing/README.md to restore it (${(error as Error).message})`,
    );
  }
  const lines = text.split('\n');
  const byName = new Map<string, CosIngRecord>();
  const stripped = new Map<string, CosIngRecord[]>();
  const casByName = new Map<string, string>();
  let rows = 0;

  for (const line of lines) {
    if (!line) continue;
    const cells = line.split('\t');
    if (cells.length < 2) continue;
    const inci = (cells[0] ?? '').trim();
    if (!inci || inci === 'inci') continue; // header
    rows += 1;
    const cas = (cells[1] ?? '').trim() || undefined;
    const ec = (cells[2] ?? '').trim() || undefined;
    const restrictionText = (cells[4] ?? '').trim() || undefined;
    const rec: CosIngRecord = {
      inci,
      cas,
      ec,
      functions: splitFunctions(cells[3]?.trim()),
      restrictionText,
      annexCodes: parseAnnexCodes(restrictionText),
    };
    const key = normalizeInciToken(inci);
    // Keep the first occurrence of a normalized name (rows were deduped at
    // build time; this guards against accidental duplicates on refresh).
    if (!byName.has(key)) byName.set(key, rec);
    const strippedKey = normalizeWithoutParens(inci);
    if (strippedKey && strippedKey !== key) {
      const list = stripped.get(strippedKey) ?? [];
      list.push(rec);
      stripped.set(strippedKey, list);
    }
    if (rec.cas && !casByName.has(rec.cas)) casByName.set(rec.cas, rec.inci);
  }

  cache = {
    meta: {
      rows,
      snapshot: '2019-03-13 official export, merged 2026-09-07 (see data/cosing/README.md)',
      version: 'cosing-tsv-1',
    },
    byName,
    byStrippedName: stripped,
    casByName,
  };
  return cache;
}

export interface IngredientLookup {
  record?: CosIngRecord;
  /** How the name was resolved. */
  via: 'exact' | 'alias' | 'paren-stripped' | 'none';
}

/**
 * Resolve one label token against the CosIng snapshot.
 *
 * Order: exact normalized key → alias map → unique parenthetical-stripped
 * candidate. The last step only fires when exactly one dataset row matches the
 * stripped spelling, which catches "Cocos Nucifera (Coconut) Oil" vs a label
 * that omits "(Coconut)" without ever guessing between two ingredients.
 */
export function lookupIngredient(raw: string): IngredientLookup {
  const ds = loadCosingDataset();
  const key = normalizeInciToken(raw);
  if (!key) return { via: 'none' };

  // Curated aliases take precedence over identifier-only duplicates in the
  // merged snapshot (e.g. "WATER" and "AQUA" both exist; the alias sends the
  // label to the official row that carries functions).
  const canonical = resolveAlias(key);
  if (canonical) {
    const viaAlias = ds.byName.get(canonical);
    if (viaAlias) return { record: viaAlias, via: 'alias' };
  }

  const exact = ds.byName.get(key);
  if (exact) return { record: exact, via: 'exact' };

  // "AQUA (WATER)" → stripped "AQUA" may be the dataset key itself.
  const strippedKey = normalizeWithoutParens(raw);
  if (strippedKey && strippedKey !== key) {
    const viaStrippedExact = ds.byName.get(strippedKey);
    if (viaStrippedExact) return { record: viaStrippedExact, via: 'paren-stripped' };
    const candidates = ds.byStrippedName.get(strippedKey);
    if (candidates && candidates.length === 1) {
      return { record: candidates[0], via: 'paren-stripped' };
    }
  }

  return { via: 'none' };
}

/** Look an ingredient up by its CAS number (secondary matching, e.g. debug). */
export function lookupByCas(cas: string): CosIngRecord | undefined {
  const ds = loadCosingDataset();
  const inci = ds.casByName.get(cas);
  return inci ? ds.byName.get(normalizeInciToken(inci)) : undefined;
}
