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

/**
 * Each uncached lookup walks up to five upstream hosts, and an unreachable host
 * burns the full per-request timeout before the next is tried — so one client can
 * hold an edge function for tens of seconds at a time. The route is unauthenticated
 * by design (it returns public product data, no user data), which makes a per-IP
 * budget plus one shared deadline the only bound on that cost.
 */
const LOOKUPS_PER_MINUTE = 60;
const GLOBAL_DEADLINE_MS = 12_000;
const hitsByIp = new Map<string, { at: number; count: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hitsByIp.get(ip);
  if (!entry || now - entry.at >= 60_000) {
    hitsByIp.set(ip, { at: now, count: 1 });
  } else {
    entry.count += 1;
  }
  // Bound the map itself; stale buckets are worthless.
  if (hitsByIp.size > 10_000) {
    for (const [key, value] of hitsByIp) {
      if (now - value.at >= 60_000) hitsByIp.delete(key);
    }
  }
  return hitsByIp.get(ip)!.count > LOOKUPS_PER_MINUTE;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') ?? '';
  if (!/^[0-9]{8}$/.test(code) && !/^[0-9]{13}$/.test(code)) {
    return NextResponse.json({ status: 0, found: false, product: null, error: 'invalid code' }, { status: 400 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'local';
  if (rateLimited(ip)) {
    return NextResponse.json(
      { status: 0, found: false, product: null, error: 'too many lookups' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }


  const cached = cacheGet(code);
  if (cached !== undefined) {
    return NextResponse.json(cached);
  }

  let notFound = false;
  const deadline = AbortSignal.timeout(GLOBAL_DEADLINE_MS);

  for (const base of OFF_HOSTS) {
    if (deadline.aborted) break;
    try {
      const res = await fetch(`${base}${code}.json?fields=${FIELDS}`, {
        // The shorter of the per-host grace and the request-wide deadline, so a
        // slow host cannot stretch one lookup past five sequential timeouts.
        signal: AbortSignal.any([AbortSignal.timeout(6000), deadline]),
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
