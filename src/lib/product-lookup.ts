/**
 * Open Food Facts barcode lookup (client side).
 *
 * Tries the OFF API directly from the browser — the world instance first,
 * then the Morocco instance (`ma-fr.openfoodfacts.org`, which carries local
 * MA data); if both fail (offline, CORS, timeout) it falls back to the app's
 * own `/api/barcode/lookup` proxy, which fetches server-side. All paths
 * return the same OFF-shaped payload so there is a single mapper.
 *
 * Privacy: only the barcode digits leave the device — never user data.
 */
import type { ProductKind, RemoteProductInfo } from './course-session';

const OFF_HOSTS: Array<{ base: string; kind: ProductKind }> = [
  { base: 'https://world.openfoodfacts.org/api/v2/product/', kind: 'food' },
  { base: 'https://ma-fr.openfoodfacts.org/api/v2/product/', kind: 'food' },
  { base: 'https://ma.openfoodfacts.org/api/v2/product/', kind: 'food' },
  { base: 'https://world.openbeautyfacts.org/api/v2/product/', kind: 'beauty' },
  { base: 'https://world.openproductsfacts.org/api/v2/product/', kind: 'generic' },
];
const FIELDS =
  'code,product_name,product_name_fr,product_name_en,generic_name,brands,image_front_url,categories,quantity,ingredients';

/**
 * Map an OFF v2 product payload to our fields. Accepts both the raw OFF
 * shape (`{ status: 1, product }`) and the app-proxy shape
 * (`{ found: true, product, source }`) — historically the proxy only returned
 * `found`, which made every proxied lookup read as "not found".
 *
 * `kind` tags which database resolved the product (drives the cosmetic
 * quality panel). The direct lookup paths pass it explicitly; proxied
 * payloads carry it as `source` on the root.
 */
export function mapOffProduct(data: unknown, kind?: ProductKind): RemoteProductInfo | null {
  const root = data as
    | { status?: number; found?: boolean; source?: string; product?: Record<string, unknown> }
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
  // OBF stores the INCI list as a comma-separated string.
  const ingredients = pick('ingredients')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const resolvedKind: ProductKind | undefined =
    kind ??
    (root.source === 'food' || root.source === 'beauty' || root.source === 'generic' ? root.source : undefined);

  return {
    name,
    ...(brands ? { brand: brands } : {}),
    ...(category ? { category } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(quantity ? { quantity } : {}),
    ...(ingredients && ingredients.length > 0 ? { ingredients } : {}),
    ...(resolvedKind ? { productKind: resolvedKind } : {}),
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
 * Look up a barcode on Open Food Facts (world → Morocco instance), then via
 * the app proxy. Returns null when the product is not found (or every path
 * failed — the caller then offers manual entry).
 */
export async function lookupOffProduct(
  barcode: string,
  opts?: { timeoutMs?: number; proxyUrl?: string },
): Promise<RemoteProductInfo | null> {
  const timeoutMs = opts?.timeoutMs ?? 4000;
  const proxyUrl = opts?.proxyUrl ?? '/api/barcode/lookup';

  // 1) direct from the browser — world, then the MA instance
  for (const { base, kind } of OFF_HOSTS) {
    const direct = await fetchJson(`${base}${barcode}.json?fields=${FIELDS}`, timeoutMs);
    const mapped = direct ? mapOffProduct(direct, kind) : null;
    if (mapped) return mapped;
  }

  // 2) through the app proxy (server-side fetch — also the CORS fallback)
  const proxied = await fetchJson(`${proxyUrl}?code=${encodeURIComponent(barcode)}`, timeoutMs);
  if (proxied) return mapOffProduct(proxied);

  return null;
}
