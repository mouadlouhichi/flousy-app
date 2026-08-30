import { NextResponse } from 'next/server';

/**
 * Barcode lookup proxy — Open Food Facts, server-side fetch.
 *
 * The client tries the OFF API directly first; this route is the fallback
 * when the browser cannot reach it (CORS policies, restrictive networks).
 * Server-side it also avoids any browser CORS questions entirely.
 *
 * Stores no user data — barcodes only — in a small in-memory LRU so
 * repeated scans of the same code don't hammer OFF.
 */

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS =
  'code,product_name,product_name_fr,product_name_en,brands,image_front_url,categories,quantity';

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
    return NextResponse.json({ found: false, product: null, error: 'invalid code' }, { status: 400 });
  }

  const cached = cacheGet(code);
  if (cached !== undefined) {
    return NextResponse.json(cached);
  }

  try {
    const res = await fetch(`${OFF_BASE}${code}.json?fields=${FIELDS}`, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'SmartJib (course session product lookup)' },
    });
    const body = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    const payload = { found: body.status === 1, product: body.product ?? null };
    cacheSet(code, payload);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ found: false, product: null, error: 'lookup failed' }, { status: 502 });
  }
}
