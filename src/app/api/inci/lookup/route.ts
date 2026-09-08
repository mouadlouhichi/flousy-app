import { NextResponse, type NextRequest } from 'next/server';
import { fetchVendorInci, isVendorConfigured } from '@/lib/server/vendor-inci';
import { isRateLimited } from '@/lib/server/rate-limit';
import { checkArcjet } from '@/lib/server/arcjet';

/**
 * INCI fallback lookup — barcode → ingredient list.
 *
 * Used by the scan-flow UX when a cosmetic product resolves (from OBF or a
 * category-clean beauty mirror) without a transcribed INCI list. It asks the
 * key-gated provider (see src/lib/server/vendor-inci.ts) for the ingredient
 * text and returns it to the client so the normal, deterministic local
 * analysis can score the label. No key → the route is a one-line, zero
 * network no-op (fail-open); a provider error is also returned as
 * `found: false` so the scan flow degrades to today's paste/OCR path.
 *
 * Privacy: only the barcode digits reach the app and the provider — never
 * user data. The key stays server-side. Responses are small and cached
 * in-memory for the same five-minute window as the barcode proxy.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOOKUPS_PER_MINUTE = 60;
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
  cache.delete(key);
  cache.set(key, hit); // refresh LRU
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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') ?? '';
  if (!/^[0-9]{8}$/.test(code) && !/^[0-9]{13}$/.test(code)) {
    return NextResponse.json({ found: false, reason: 'invalid code' }, { status: 400 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'local';
  const arcjet = await checkArcjet(request);
  if (arcjet.denied) {
    return NextResponse.json({ found: false, reason: 'blocked' }, { status: 403 });
  }
  if (await isRateLimited('inci-lookup', ip, LOOKUPS_PER_MINUTE, 60_000)) {
    return NextResponse.json(
      { found: false, reason: 'too many lookups' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const cached = cacheGet(code);
  if (cached !== undefined) return NextResponse.json(cached);

  // No key → pure no-op. Returning 200 keeps the client on one code path;
  // the client maps this to `unavailable` (not a product verdict).
  if (!isVendorConfigured()) {
    const payload = { found: false, reason: 'not-configured' };
    cacheSet(code, payload);
    return NextResponse.json(payload);
  }

  const inci = await fetchVendorInci(code);
  const payload = inci
    ? { found: true, ingredientsText: inci }
    : { found: false, reason: 'not-found' };
  // Both outcomes are deterministic for the code and are cached; provider
  // errors return null from `fetchVendorInci` so a one-off failure just
  // becomes a retryable `not-found` at the UI (never a false risk score).
  cacheSet(code, payload);
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
