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
 * - Enabled only when COSMETIC_INCI_API_KEY is set (never shipped to the
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

export const VENDOR_INCI_ENDPOINT = 'https://inciapi.com/v1/products/';
type EnvVarMap = Record<string, string | undefined>;
const VENDOR_TIMEOUT_MS = 3_000;
const MAX_INCI_LENGTH = 8_000;

export function vendorKey(env: EnvVarMap = process.env): string | undefined {
  const key = env.COSMETIC_INCI_API_KEY;
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
