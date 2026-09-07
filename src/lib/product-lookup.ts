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
 * INCI_API fallback result, as produced by `/api/inci/lookup` (the server
 * proxy that holds the API key).
 */
export function mapInciProduct(data: unknown): RemoteProductInfo | null {
  const root = data as
    | { found?: boolean; product?: Record<string, unknown> }
    | null
    | undefined;
  if (!root || root.found !== true || !root.product) return null;
  const p = root.product;

  const str = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

  const name = str(p.name);
  if (!name) return null;
  const brand = str(p.brand);
  const category = str(p.category);
  const imageUrl = str(p.imageUrl);
  let ingredients: string[] | undefined;
  if (Array.isArray(p.ingredients)) {
    const list = p.ingredients.map((part) => String(part).trim()).filter(Boolean);
    if (list.length > 0) ingredients = list;
  }

  return {
    name,
    ...(brand ? { brand } : {}),
    ...(category ? { category } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(ingredients ? { ingredients } : {}),
    // INCI_API is a cosmetics database — a hit is always a beauty product.
    productKind: 'beauty' as ProductKind,
  };
}

/**
 * Look up a barcode across the available product datasets, then — when they
 * don't yield an INCI list — fall back to INCI_API by barcode.
 *
 * 1. Every available dataset is searched **in parallel** (all OFF/OBF hosts
 *    plus the app proxy, one `Promise.all`); the first hit in host-priority
 *    order wins.
 * 2. When nothing was found, or the hit is a beauty product without a
 *    transcribed INCI list, the call is sent to INCI_API (through the app's
 *    server proxy, which holds the API key). Food/generic hits are final:
 *    the cosmetics database has nothing to add for them.
 *
 * Returns null when no source knows the product (the caller then offers
 * manual entry).
 */
export async function lookupOffProduct(
  barcode: string,
  opts?: { timeoutMs?: number; proxyUrl?: string; inciUrl?: string },
): Promise<RemoteProductInfo | null> {
  const timeoutMs = opts?.timeoutMs ?? 4000;
  const proxyUrl = opts?.proxyUrl ?? '/api/barcode/lookup';
  const inciUrl = opts?.inciUrl ?? '/api/inci/lookup';

  // 1) Search every available dataset in parallel — first hit by priority wins.
  const [directs, proxied] = await Promise.all([
    Promise.all(
      OFF_HOSTS.map((host) => fetchJson(`${host.base}${barcode}.json?fields=${FIELDS}`, timeoutMs)),
    ),
    fetchJson(`${proxyUrl}?code=${encodeURIComponent(barcode)}`, timeoutMs),
  ]);
  const hit =
    directs
      .map((data, i) => (data ? mapOffProduct(data, OFF_HOSTS[i].kind) : null))
      .find((mapped): mapped is RemoteProductInfo => mapped !== null) ??
    (proxied ? mapOffProduct(proxied) : null);

  // A food/generic hit is final — INCI_API is a cosmetics database.
  if (hit && hit.productKind !== 'beauty') return hit;
  // A beauty hit that already carries its INCI list is final too.
  if (hit && hit.ingredients && hit.ingredients.length > 0) return hit;

  // 2) Fallback: send the call to INCI_API (not-found items, or beauty hits
  //    whose record has no transcribed ingredient list).
  const inci = mapInciProduct(
    await fetchJson(`${inciUrl}?code=${encodeURIComponent(barcode)}`, timeoutMs),
  );
  if (!inci) return hit ?? null;
  if (!hit) return inci;

  // Keep the identity the datasets already showed (name/brand/image); the
  // INCI database supplies the ingredient list.
  const brand = hit.brand ?? inci.brand;
  const category = hit.category ?? inci.category;
  const imageUrl = hit.imageUrl ?? inci.imageUrl;
  const quantity = hit.quantity;
  return {
    name: hit.name || inci.name,
    ...(brand ? { brand } : {}),
    ...(category ? { category } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(quantity ? { quantity } : {}),
    ...(inci.ingredients ? { ingredients: inci.ingredients } : {}),
    productKind: 'beauty' as ProductKind,
  };
}
