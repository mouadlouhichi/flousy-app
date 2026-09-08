/**
 * Optional cosmetic-ingredient enrichment for the barcode proxy.
 *
 * When Open Beauty Facts returns a cosmetic product but no transcribed INCI
 * list (crowd-sourced gap), the barcode proxy (/api/barcode/lookup) or the
 * client-facing INCI fallback (/api/inci/lookup) may ask a third-party
 * barcode→INCI provider for the ingredient text. The vendor is used ONLY as
 * an INCI data source — the app's own deterministic scoring engine
 * (src/lib/ingredient-safety/*) remains the single place that judges
 * ingredients, so the EU overlay and local CosIng snapshot stay consistent
 * regardless of which source supplied the text.
 *
 * Privacy & availability:
 * - Enabled only when INCI_API_KEY is set (never shipped to the
 *   client; only the barcode digits leave the server, matching the rest of
 *   the app). Without the key this module is a pure no-op — zero network.
 * - Fail-open and bounded: short timeout, caps on response size, every error
 *   returns null so the scan flow degrades to today's behaviour.
 *
 * Provider note (2026-09): "INCI API" (inciapi.com) currently advertises a
 * free barcode→product→INCI endpoint (GET /v1/products/:barcode/safety with an
 * X-API-Key header); fallback shapes are still accepted so a provider rename
 * degrades to no enrichment rather than a broken score. Free-tier quota varies
 * as the product matures, so the route-level rate limit plus this env gate
 * keep cost under control. Swap the fetch inside for any provider that returns
 * the same shape.
 */

import { normalizeInciToken } from '@/lib/ingredient-safety/normalize';
import type { ExternalIngredientEvidence } from '@/lib/ingredient-safety/types';
import { isValidGtin } from '@/lib/gtin';

export const VENDOR_INCI_ENDPOINT = 'https://inciapi.com/v1/products/';
/**
 * Barcode endpoint per the provider docs: GET /v1/products/:barcode/safety
 * (the barcode-only path returns the product metadata; /safety returns the
 * INCI list + analysis used to build the ingredient text).
 */
export const VENDOR_INCI_SAFETY_PATH = '/safety';
/** Free-text INCI analysis (POST /v1/analyze per the provider docs). */
export const VENDOR_INCI_ANALYZE_ENDPOINT = 'https://inciapi.com/v1/analyze';
type EnvVarMap = Record<string, string | undefined>;
const VENDOR_TIMEOUT_MS = 3_000;
const MAX_INCI_LENGTH = 8_000;

export function vendorKey(env: EnvVarMap = process.env): string | undefined {
  const key = env.INCI_API_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : undefined;
}

export function isVendorConfigured(env: EnvVarMap = process.env): boolean {
  return vendorKey(env) !== undefined;
}

/**
 * Extract an INCI text string from a vendor payload. Accepts the documented
 * response shapes defensively (field renames happen often in young APIs) and
 * normalizes to a single comma-separated text our mapper already understands.
 */
export function extractVendorInci(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as {
    rawInci?: unknown;
    parsedIngredients?: unknown;
    analysis?: { rawInci?: unknown; parsedIngredients?: unknown };
    product?: Record<string, unknown>;
  };
  const product = root.product;

  const details = (product?.details as { inci?: unknown } | undefined)?.inci;
  // Documented /v1/products/:barcode/safety shape: top-level rawInci or
  // parsedIngredients. Older/free-tier shapes used product.details.inci or
  // product.ingredients. Accepting all four keeps the client robust while the
  // provider evolves.
  const rawInci =
    root.rawInci ??
    root.analysis?.rawInci ??
    details ??
    product?.ingredients;

  if (typeof rawInci === 'string') {
    const text = rawInci.trim();
    return text && text.length <= MAX_INCI_LENGTH ? text : null;
  }
  if (Array.isArray(rawInci)) {
    const names = rawInci
      .map((entry) =>
        typeof entry === 'string'
          ? entry.trim()
          : entry && typeof entry === 'object'
            ? String((entry as { inciName?: unknown; name?: unknown }).inciName ?? (entry as { name?: unknown }).name ?? '').trim()
            : '',
      )
      .filter(Boolean);
    if (names.length === 0) return null;
    const joined = names.join(', ');
    return joined.length > 0 && joined.length <= MAX_INCI_LENGTH ? joined : null;
  }

  // Safety response may keep INCI only as parsedIngredients (objects with
  // inciName/name) rather than rawInci.
  const parsed =
    root.parsedIngredients ?? root.analysis?.parsedIngredients;
  if (Array.isArray(parsed)) {
    const names = parsed
      .map((entry) =>
        entry && typeof entry === 'object'
          ? String((entry as { inciName?: unknown; name?: unknown }).inciName ?? (entry as { name?: unknown }).name ?? '').trim()
          : '',
      )
      .filter(Boolean);
    if (names.length === 0) return null;
    const joined = names.join(', ');
    return joined.length > 0 && joined.length <= MAX_INCI_LENGTH ? joined : null;
  }

  return null;
}

/** Minimal product fields used when only the vendor knows the code. */
export interface VendorProductInfo {
  name: string;
  brand?: string;
  ingredientsText: string;
}

export function extractVendorProduct(body: unknown): VendorProductInfo | null {
  const root = body as {
    product?: Record<string, unknown>;
    productName?: unknown;
    name?: unknown;
    brand?: unknown;
    brands?: unknown;
  } | null;
  if (!root || typeof root !== 'object') return null;
  const product: Record<string, unknown> =
    root.product ?? (root as unknown as Record<string, unknown>);
  const pickName = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;
  const name =
    pickName(product.product_name) ??
    pickName(product.productName) ??
    pickName(root.productName) ??
    pickName(product.name) ??
    pickName(root.name) ??
    undefined;
  if (!name) return null;
  const ingredientsText = extractVendorInci(body);
  if (!ingredientsText) return null;
  const brand =
    pickName(product.brand) ??
    pickName(root.brand) ??
    (typeof product.brands === 'string' && product.brands.trim()
      ? product.brands.split(',')[0].trim()
      : undefined) ??
    (typeof root.brands === 'string' && root.brands.trim()
      ? root.brands.split(',')[0].trim()
      : undefined);
  return { name, ...(brand ? { brand } : {}), ingredientsText };
}

type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const defaultFetch: FetchLike = (url, init) =>
  fetch(url, init as RequestInit) as Promise<{
    ok: boolean;
    json: () => Promise<unknown>;
  }>;

/** Fetch a vendor payload; null when no endpoint answered (fail-open, no key = no call).
 *
 * Tries the documented `/safety` endpoint first, then the plain barcode
 * endpoint as a fallback (a provider sometimes 404s one shape but not the
 * other for the same code). Either shape is fed through `extractVendorInci`
 * / `extractVendorProduct`, so a provider rename still degrades gracefully.
 */
export async function fetchVendorPayload(
  code: string,
  env: EnvVarMap = process.env,
  fetchImpl: FetchLike = defaultFetch,
  outerSignal?: AbortSignal,
): Promise<unknown | null> {
  const key = vendorKey(env);
  if (!key || !isValidGtin(code) || outerSignal?.aborted) {
    return null;
  }

  const encoded = encodeURIComponent(code);
  const endpoints = [
    `${VENDOR_INCI_ENDPOINT}${encoded}${VENDOR_INCI_SAFETY_PATH}`,
    `${VENDOR_INCI_ENDPOINT}${encoded}`,
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VENDOR_TIMEOUT_MS);
  try {
    for (const url of endpoints) {
      try {
        const res = await fetchImpl(url, {
          headers: { 'X-API-Key': key, Accept: 'application/json' },
          signal: outerSignal ? AbortSignal.any([outerSignal, controller.signal]) : controller.signal,
        });
        if (!res.ok) continue;
        return await res.json();
      } catch {
        // Try the next endpoint; a fully-quiet network still returns null below.
      }
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Enrichment: vendor supplies the INCI list for a code nobody else had. */
export async function fetchVendorInci(
  code: string,
  env: EnvVarMap = process.env,
  fetchImpl: FetchLike = defaultFetch,
  signal?: AbortSignal,
): Promise<string | null> {
  const body = await fetchVendorPayload(code, env, fetchImpl, signal);
  return extractVendorInci(body);
}

/** Fallback find: vendor knows product name + INCI for an unknown code. */
export async function fetchVendorProduct(
  code: string,
  env: EnvVarMap = process.env,
  fetchImpl: FetchLike = defaultFetch,
  signal?: AbortSignal,
): Promise<VendorProductInfo | null> {
  const body = await fetchVendorPayload(code, env, fetchImpl, signal);
  return extractVendorProduct(body);
}

// ---------------------------------------------------------------------------
// External analysis evidence. Every provider verdict is retained with source
// attribution, but it is informational only: it never creates a local tier,
// clears a concern, or improves the numeric score.
// ---------------------------------------------------------------------------

export interface VendorAnalyzeEntry {
  /** Name as returned by the provider (already normalized by them). */
  inciName: string;
  safetyLevel?: string;
  safetyScore?: number;
  found?: boolean;
}

export function extractVendorAnalyzeEntries(body: unknown): VendorAnalyzeEntry[] {
  if (!body || typeof body !== 'object') return [];
  const root = body as {
    parsedIngredients?: unknown;
    ingredients?: unknown;
    analysis?: { parsedIngredients?: unknown };
  };
  const raw = root.parsedIngredients ?? root.analysis?.parsedIngredients ?? root.ingredients;
  if (!Array.isArray(raw)) return [];
  const entries: VendorAnalyzeEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as {
      inciName?: unknown;
      name?: unknown;
      safetyLevel?: unknown;
      safetyScore?: unknown;
      found?: unknown;
    };
    const inciName =
      typeof obj.inciName === 'string'
        ? obj.inciName.trim()
        : typeof obj.name === 'string'
          ? obj.name.trim()
          : '';
    if (!inciName) continue;
    entries.push({
      inciName,
      ...(typeof obj.safetyLevel === 'string' && obj.safetyLevel.trim()
        ? { safetyLevel: obj.safetyLevel.trim() }
        : {}),
      ...(typeof obj.safetyScore === 'number' ? { safetyScore: obj.safetyScore } : {}),
      ...(typeof obj.found === 'boolean' ? { found: obj.found } : {}),
    });
  }
  return entries;
}

/** Build a normalized-name → attributed provider-evidence map. */
export function buildVendorEvidence(
  entries: readonly VendorAnalyzeEntry[],
): Map<string, ExternalIngredientEvidence> {
  const map = new Map<string, ExternalIngredientEvidence>();
  for (const entry of entries) {
    const name = entry.inciName.trim();
    const key = normalizeInciToken(name);
    if (!key) continue;
    map.set(key, {
      provider: 'INCI API (inciapi.com)',
      reportedName: name,
      ...(entry.safetyLevel ? { verdict: entry.safetyLevel } : {}),
      ...(entry.safetyScore !== undefined ? { score: entry.safetyScore } : {}),
      ...(entry.found !== undefined ? { found: entry.found } : {}),
      informationalOnly: true,
    });
  }
  return map;
}

/** @deprecated Use buildVendorEvidence. Kept for integrations compiled against
 * the old name; semantics are now informational-only and include all verdicts. */
export const buildVendorRecognition = buildVendorEvidence;

type AnalyzeFetchImpl = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const defaultAnalyzeFetch: AnalyzeFetchImpl = (url, init) =>
  fetch(url, init as RequestInit) as Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/**
 * Ask the vendor about names the local glossary missed. Raw names are sent only
 * when the optional provider is configured; every returned verdict is kept as
 * attributed informational evidence.
 */
export async function fetchVendorAnalyzeEvidence(
  names: readonly string[],
  env: EnvVarMap = process.env,
  fetchImpl: AnalyzeFetchImpl = defaultAnalyzeFetch,
): Promise<Map<string, ExternalIngredientEvidence>> {
  const key = vendorKey(env);
  if (!key || names.length === 0) return new Map();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VENDOR_TIMEOUT_MS);
  try {
    const res = await fetchImpl(VENDOR_INCI_ANALYZE_ENDPOINT, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ingredients: names.slice(0, 300) }),
      signal: controller.signal,
    });
    if (!res.ok) return new Map();
    const body = await res.json();
    return buildVendorEvidence(extractVendorAnalyzeEntries(body));
  } catch {
    return new Map();
  } finally {
    clearTimeout(timer);
  }
}

/** @deprecated Use fetchVendorAnalyzeEvidence. */
export const fetchVendorAnalyzeRecognition = fetchVendorAnalyzeEvidence;
