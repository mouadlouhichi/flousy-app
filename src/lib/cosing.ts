/**
 * EU CosIng regulatory index (public/data/cosing.json).
 *
 * CosIng is the European Commission's database of cosmetic ingredients:
 * per-ingredient functions and Annex memberships (II prohibited, III
 * restricted, IV colorants, V preservatives, VI UV filters). The bundled
 * JSON is a distillation of the official EU export (CC BY 4.0) — see the
 * `meta` block inside the file for sources and vintage.
 *
 * The module is pure where it matters: `buildCosingIndex` and
 * `lookupCosing` are unit-tested against fixtures; `loadCosingIndex` is the
 * only async bit (one fetch, in-memory cache). A failed load degrades to
 * the curated-only classification — the app never blocks on this data.
 */

/** Annex bit flags packed into one byte per ingredient. */
export const COSING_BITS = {
  /** Annex II — prohibited in EU cosmetics. */
  BANNED: 1,
  /** Annex III — allowed only under restrictions (max % / warnings). */
  RESTRICTED: 2,
  /** Annex IV — authorized colorant. */
  COLORANT: 4,
  /** Annex V — authorized preservative. */
  PRESERVATIVE: 8,
  /** Annex VI — authorized UV filter. */
  UV_FILTER: 16,
} as const;

/** Raw shape of public/data/cosing.json. */
export interface CosingFile {
  meta?: { source?: string; fetched?: string; note?: string };
  /** Function-name dictionary; `map` values reference it by index. */
  fns: string[];
  /** CANONICAL INCI name → [function indices (≤4), annex bits]. */
  map: Record<string, [number[], number]>;
}

export interface CosingIndex {
  fns: string[];
  map: Record<string, [number[], number]>;
}

/**
 * Canonical lookup key: same folding as inci-quality's canonInci (upper,
 * whitespace-folded, `/` and `-` → space) so OCR variants and label
 * spellings both resolve.
 */
export function canonInciKey(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[/\-]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * A few INCI names that appear on labels under a synonym the official
 * inventory doesn't use (it records the INN instead).
 */
const COSING_ALIASES: Record<string, string> = {
  OXYBENZONE: 'BENZOPHENONE 3',
  OCTINOXATE: 'ETHYLHEXYL METHOXYCINNAMATE',
  OCTISALATE: 'ETHYLHEXYL SALICYLATE',
};

export interface CosingHit {
  /** Official CosIng function names (max 4, file order). */
  functions: string[];
  /** COSING_BITS flags for this ingredient. */
  bits: number;
}

/** Resolve an (already canonical) INCI name through the alias table. */
export function resolveCosingName(canonical: string): string {
  return COSING_ALIASES[canonical] ?? canonical;
}

/**
 * Normalize/validate a raw CosIng file into an index. Throws on a corrupt
 * file (bad shape, out-of-range function index) so callers can fall back
 * to the curated-only index instead of rendering garbage.
 */
export function buildCosingIndex(raw: CosingFile): CosingIndex {
  if (!raw || !Array.isArray(raw.fns) || !raw.map || typeof raw.map !== 'object') {
    throw new Error('cosing: bad file shape');
  }
  const map: Record<string, [number[], number]> = {};
  for (const [name, value] of Object.entries(raw.map)) {
    if (!Array.isArray(value) || value.length !== 2) continue;
    const fns = value[0];
    const bits = value[1];
    if (!Array.isArray(fns) || typeof bits !== 'number') continue;
    const fnIdxs = fns.filter((i) => Number.isInteger(i) && i >= 0 && i < raw.fns.length);
    if (!name || (!fnIdxs.length && !bits)) continue;
    map[name] = [fnIdxs, bits & 0b11111];
  }
  return { fns: [...raw.fns], map };
}

/** Look up an ingredient (any spelling) in the index. */
export function lookupCosing(index: CosingIndex, inci: string): CosingHit | undefined {
  const key = resolveCosingName(canonInciKey(inci));
  const hit = index.map[key];
  if (!hit) return undefined;
  const [fnIdxs, bits] = hit;
  return { functions: fnIdxs.map((i) => index.fns[i]).filter(Boolean), bits };
}

let cache: CosingIndex | null | undefined;

/**
 * Fetch + cache the bundled CosIng index. Returns null (and caches the
 * failure) when the file is missing/corrupt — classification then runs
 * with the curated rules only.
 */
export async function loadCosingIndex(): Promise<CosingIndex | null> {
  if (cache !== undefined) return cache;
  try {
    const res = await fetch('/data/cosing.json');
    if (!res.ok) throw new Error(`cosing: HTTP ${res.status}`);
    const raw = (await res.json()) as CosingFile;
    cache = buildCosingIndex(raw);
  } catch {
    cache = null;
  }
  return cache;
}
