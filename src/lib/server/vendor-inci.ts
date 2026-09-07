/**
 * Optional cosmetic-ingredient enrichment for the barcode proxy.
 *
 * When Open Beauty Facts returns a cosmetic product but no transcribed INCI
 * list (crowd-sourced gap), the proxy may ask a third-party barcode→INCI
 * provider for the ingredient text. The vendor is used ONLY as an INCI data
 * source — the app's own deterministic scoring engine
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
 * free barcode→product→INCI endpoint (GET /v1/products/:barcode with an
 * X-API-Key header). Free-tier quota varies as the product matures, so the
 * route-level rate limit plus this env gate keep cost under control. Swap the
 * fetch inside for any provider that returns the same shape.
 */

import { normalizeInciToken } from '@/lib/ingredient-safety/normalize';

export const VENDOR_INCI_ENDPOINT = 'https://inciapi.com/v1/products/';
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
  const product = (body as { product?: Record<string, unknown> } | null)?.product;
  if (!product) return null;

  const details = product.details as { inci?: unknown } | undefined;
  const rawInci = details?.inci ?? product.ingredients;
  if (typeof rawInci === 'string') {
    const text = rawInci.trim();
    return text && text.length <= MAX_INCI_LENGTH ? text : null;
  }
  if (Array.isArray(rawInci)) {
    const names = rawInci
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
    if (names.length === 0) return null;
    const joined = names.join(', ').slice(0, MAX_INCI_LENGTH);
    return joined.length > 0 ? joined : null;
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
  const product = (body as { product?: Record<string, unknown> } | null)?.product;
  if (!product) return null;
  const name =
    typeof product.product_name === 'string' && product.product_name.trim()
      ? product.product_name.trim()
      : typeof product.name === 'string' && product.name.trim()
        ? product.name.trim()
        : undefined;
  if (!name) return null;
  const ingredientsText = extractVendorInci(body);
  if (!ingredientsText) return null;
  const brand =
    typeof product.brand === 'string' && product.brand.trim()
      ? product.brand.trim()
      : typeof product.brands === 'string' && product.brands.trim()
        ? product.brands.split(',')[0].trim()
        : undefined;
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

/** Fetch a vendor payload; null on any failure (fail-open, no key = no call). */
export async function fetchVendorPayload(
  code: string,
  env: EnvVarMap = process.env,
  fetchImpl: FetchLike = defaultFetch,
): Promise<unknown | null> {
  const key = vendorKey(env);
  if (!key || (!/^[0-9]{8}$/.test(code) && !/^[0-9]{13}$/.test(code))) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VENDOR_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${VENDOR_INCI_ENDPOINT}${encodeURIComponent(code)}`, {
      headers: { 'X-API-Key': key, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
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
): Promise<string | null> {
  const body = await fetchVendorPayload(code, env, fetchImpl);
  return extractVendorInci(body);
}

/** Fallback find: vendor knows product name + INCI for an unknown code. */
export async function fetchVendorProduct(
  code: string,
  env: EnvVarMap = process.env,
  fetchImpl: FetchLike = defaultFetch,
): Promise<VendorProductInfo | null> {
  const body = await fetchVendorPayload(code, env, fetchImpl);
  return extractVendorProduct(body);
}

// ---------------------------------------------------------------------------
// Analysis fallback — coverage enrichment for names the LOCAL CosIng snapshot
// does not recognize. The provider's per-ingredient entries are adopted ONLY
// when their reported safety level maps 1:1 to one of our tiers ('safe' →
// clean); any other verdict is ignored, so a third party can never inject a
// penalty (or a clean bill) the local model did not intend. Parsing is
// defensive and every failure degrades to the pure-local result.
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

/**
 * Build the normalized-name → recognition map consumed by the analysis
 * engine. Keys match the engine's normalizeInciToken output. Only entries the
 * vendor explicitly reports as 'safe' are adopted (clean tier); anything else
 * — unknown levels, found:false — is left unrecognized.
 */
export function buildVendorRecognition(
  entries: readonly VendorAnalyzeEntry[],
): Map<string, { label: string; detail: string; evidence: string[] }> {
  const map = new Map<string, { label: string; detail: string; evidence: string[] }>();
  for (const entry of entries) {
    const name = entry.inciName.trim();
    if (!name) continue;
    if (entry.found === false) continue;
    if ((entry.safetyLevel ?? '').toLowerCase() !== 'safe') continue;
    const key = normalizeInciToken(name);
    if (!key) continue;
    map.set(key, {
      label: name.toUpperCase(),
      detail:
        'Not present in the local CosIng snapshot, but reported safe by the external ' +
        `ingredient database (provider level "${entry.safetyLevel}").`,
      evidence: ['INCI API provider analysis (external database)'],
    });
  }
  return map;
}

type AnalyzeFetchImpl = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const defaultAnalyzeFetch: AnalyzeFetchImpl = (url, init) =>
  fetch(url, init as RequestInit) as Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/**
 * Ask the vendor to analyze the ingredient names the local snapshot missed.
 * POSTs the raw list; returns the recognized-safe map (empty when the vendor
 * had nothing to add or anything failed). Never called without a key.
 */
export async function fetchVendorAnalyzeRecognition(
  names: readonly string[],
  env: EnvVarMap = process.env,
  fetchImpl: AnalyzeFetchImpl = defaultAnalyzeFetch,
): Promise<Map<string, { label: string; detail: string; evidence: string[] }>> {
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
    return buildVendorRecognition(extractVendorAnalyzeEntries(body));
  } catch {
    return new Map();
  } finally {
    clearTimeout(timer);
  }
}
