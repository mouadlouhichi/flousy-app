/**
 * Open Food Facts / Open Beauty Facts barcode lookup (client side).
 *
 * Tries the OFF-family APIs directly from the browser — world food, Morocco
 * food, world beauty, French beauty (the biggest European cosmetics mirror for
 * the French brands common on Moroccan shelves), world products; if all fail
 * (offline, CORS, timeout) it falls back to the app's own `/api/barcode/lookup`
 * proxy, which fetches server-side and can enrich cosmetics that lack an INCI
 * list (see src/lib/server/vendor-inci.ts). All paths return the same
 * OFF-shaped payload so there is a single mapper.
 *
 * When a direct beauty hit comes back WITHOUT an INCI list, the proxy is asked
 * to fill the gap — this is the only case where a successful direct lookup
 * still touches the app server. Privacy: only the barcode digits leave the
 * device — never user data.
 */
import type { RemoteProductInfo } from './course-session';

const OFF_HOSTS: ReadonlyArray<{ base: string; beauty: boolean }> = [
  { base: 'https://world.openfoodfacts.org/api/v2/product/', beauty: false },
  { base: 'https://ma-fr.openfoodfacts.org/api/v2/product/', beauty: false },
  { base: 'https://ma.openfoodfacts.org/api/v2/product/', beauty: false },
  { base: 'https://world.openbeautyfacts.org/api/v2/product/', beauty: true },
  { base: 'https://fr.openbeautyfacts.org/api/v2/product/', beauty: true },
  { base: 'https://world.openproductsfacts.org/api/v2/product/', beauty: true },
];
const FIELDS =
  'code,product_name,product_name_fr,product_name_en,generic_name,brands,image_front_url,categories,quantity,' +
  'ingredients_text,ingredients_text_en,ingredients_text_fr,ingredients_text_es,ingredients_text_ar';

/**
 * Map an OFF v2 product payload to our fields. Accepts both the raw OFF
 * shape (`{ status: 1, product }`) and the app-proxy shape
 * (`{ found: true, product }`) — historically the proxy only returned
 * `found`, which made every proxied lookup read as "not found".
 */
export function mapOffProduct(data: unknown): RemoteProductInfo | null {
  const root = data as
    | { status?: number; found?: boolean; product?: Record<string, unknown> }
    | null
    | undefined;
  if (!root || !root.product) return null;
  const ok = root.status === 1 || root.found === true;
  if (!ok) return null;
  const p = root.product;

  const pick = (key: string): string | undefined => {
    const value = p[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };

  const name =
    pick('product_name') ??
    pick('product_name_fr') ??
    pick('product_name_en') ??
    pick('product_name_ar') ??
    pick('generic_name') ??
    pick('abbreviated_product_name');
  if (!name) return null;

  const brands = pick('brands')?.split(',')[0]?.trim();
  const category = pick('categories')?.split(',')[0]?.trim();
  const imageUrl = pick('image_front_url');
  const quantity = pick('quantity');
  const ingredientsText = [
    'ingredients_text',
    'ingredients_text_en',
    'ingredients_text_fr',
    'ingredients_text_es',
    'ingredients_text_ar',
  ]
    .map((key) => pick(key))
    .find((v): v is string => Boolean(v));

  return {
    name,
    ...(brands ? { brand: brands } : {}),
    ...(category ? { category } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(quantity ? { quantity } : {}),
    ...(ingredientsText ? { ingredientsText } : {}),
  };
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up a barcode on the Open Food Facts family (world → Morocco → beauty →
 * products), then via the app proxy. Returns null when the product is not
 * found (or every path failed — the caller then offers manual entry).
 *
 * A beauty hit without an INCI list triggers one extra proxy call so the
 * server can enrich the record from the configured vendor (no-op when no
 * INCI_API_KEY is set). Food hits never do — their product pages
 * carry no INCI and would only waste quota.
 */
export async function lookupOffProduct(
  barcode: string,
  opts?: { timeoutMs?: number; proxyUrl?: string },
): Promise<RemoteProductInfo | null> {
  const timeoutMs = opts?.timeoutMs ?? 4000;
  const proxyUrl = opts?.proxyUrl ?? '/api/barcode/lookup';
  const proxy = async (): Promise<RemoteProductInfo | null> => {
    const proxied = await fetchJson(`${proxyUrl}?code=${encodeURIComponent(barcode)}`, timeoutMs);
    return proxied ? mapOffProduct(proxied) : null;
  };

  // 1) direct from the browser — world, then MA food, then beauty mirrors
  for (const { base, beauty } of OFF_HOSTS) {
    const direct = await fetchJson(`${base}${barcode}.json?fields=${FIELDS}`, timeoutMs);
    const mapped = direct ? mapOffProduct(direct) : null;
    if (!mapped) continue;
    if (!beauty || mapped.ingredientsText) return mapped;
    // Beauty hit without INCI → let the server enrich it.
    return (await proxy()) ?? mapped;
  }

  // 2) through the app proxy (server-side fetch — also the CORS fallback, and
  //    the only path that can synthesize a vendor-only product).
  return proxy();
}
