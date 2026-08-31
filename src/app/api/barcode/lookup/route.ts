import { NextResponse } from 'next/server';

/**
 * Barcode lookup proxy — Open Food Facts, server-side fetch.
 *
 * The client tries the OFF API directly first; this route is the fallback
 * when the browser cannot reach it (CORS policies, restrictive networks).
 * Server-side it also avoids any browser CORS questions entirely.
 *
 * Tries the world instance then the Morocco instance (`ma-fr`) so products
 * that only exist on the localized index still resolve. The response keeps
 * BOTH `status` (OFF v2 shape) and `found` (historical proxy shape) so the
 * client mapper never mis-reads a successful hit as "not found".
 *
 * Stores no user data — barcodes only — in a small in-memory LRU so
 * repeated scans of the same code don't hammer OFF.
 */

const OFF_HOSTS = [
  'https://world.openfoodfacts.org/api/v2/product/',
  'https://ma-fr.openfoodfacts.org/api/v2/product/',
  'https://ma.openfoodfacts.org/api/v2/product/',
  'https://world.openbeautyfacts.org/api/v2/product/',
  'https://world.openproductsfacts.org/api/v2/product/',
];
const FIELDS =
  'code,product_name,product_name_fr,product_name_en,generic_name,brands,image_front_url,categories,quantity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 100;
const cache = new Map<string, { at: number; body: unknown }>();

function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  // refresh LRU position
  cache.delete(key);
  cache.set(key, hit);
  return hit.body;
}

function cacheSet(key: string, body: unknown): void {
  cache.delete(key);
  cache.set(key, { at: Date.now(), body });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code') ?? '';
  if (!/^[0-9]{8}$/.test(code) && !/^[0-9]{13}$/.test(code)) {
    return NextResponse.json({ status: 0, found: false, product: null, error: 'invalid code' }, { status: 400 });
  }

  const cached = cacheGet(code);
  if (cached !== undefined) {
    return NextResponse.json(cached);
  }

  let notFound = false;

  for (const base of OFF_HOSTS) {
    try {
      const res = await fetch(`${base}${code}.json?fields=${FIELDS}`, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'SmartJib (course session product lookup)' },
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { status?: number; product?: Record<string, unknown> };
      if (body && body.status === 1 && body.product) {
        const payload = { status: 1, found: true, product: body.product };
        cacheSet(code, payload);
        return NextResponse.json(payload);
      }
      if (body && typeof body.status === 'number') notFound = true;
    } catch {
      /* try the next host */
    }
  }

  if (notFound) {
    const payload = { status: 0, found: false, product: null };
    cacheSet(code, payload);
    return NextResponse.json(payload);
  }

  return NextResponse.json(
    { status: 0, found: false, product: null, error: 'lookup failed' },
    { status: 502 },
  );
}
