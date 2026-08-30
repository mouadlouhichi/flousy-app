/**
 * Open Food Facts barcode lookup (client side).
 *
 * Tries the public OFF API directly from the browser; if that fails
 * (offline, CORS, timeout) it falls back to the app's own
 * `/api/barcode/lookup` proxy, which fetches server-side. Both paths return
 * the same OFF-shaped payload so there is a single mapper.
 *
 * Privacy: only the barcode digits leave the device — never user data.
 */
import type { RemoteProductInfo } from './course-session';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS =
  'code,product_name,product_name_fr,product_name_en,brands,image_front_url,categories,quantity';

/** Map an OFF v2 product payload ({ status, product }) to our fields. */
export function mapOffProduct(data: unknown): RemoteProductInfo | null {
  const root = data as { status?: number; product?: Record<string, unknown> } | null | undefined;
  if (!root || root.status !== 1 || !root.product) return null;
  const p = root.product;

  const pick = (key: string): string | undefined => {
    const value = p[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };

  const name = pick('product_name') ?? pick('product_name_fr') ?? pick('product_name_en') ?? pick('generic_name');
  if (!name) return null;

  const brands = pick('brands')?.split(',')[0]?.trim();
  const category = pick('categories')?.split(',')[0]?.trim();
  const imageUrl = pick('image_front_url');
  const quantity = pick('quantity');

  return {
    name,
    ...(brands ? { brand: brands } : {}),
    ...(category ? { category } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(quantity ? { quantity } : {}),
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
 * Look up a barcode on Open Food Facts. Returns null when the product is
 * not found (or every path failed — the caller then offers manual entry).
 */
export async function lookupOffProduct(
  barcode: string,
  opts?: { timeoutMs?: number; proxyUrl?: string },
): Promise<RemoteProductInfo | null> {
  const timeoutMs = opts?.timeoutMs ?? 4000;
  const proxyUrl = opts?.proxyUrl ?? '/api/barcode/lookup';

  // 1) direct from the browser
  const direct = await fetchJson(`${OFF_BASE}${barcode}.json?fields=${FIELDS}`, timeoutMs);
  if (direct) return mapOffProduct(direct);

  // 2) through the app proxy (server-side fetch — also the CORS fallback)
  const proxied = await fetchJson(`${proxyUrl}?code=${encodeURIComponent(barcode)}`, timeoutMs);
  if (proxied) return mapOffProduct(proxied);

  return null;
}
