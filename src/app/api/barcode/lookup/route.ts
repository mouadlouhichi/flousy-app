import { NextResponse, type NextRequest } from 'next/server';
import { isRateLimited } from '@/lib/server/rate-limit';
import { checkArcjet } from '@/lib/server/arcjet';

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
  'code,product_name,product_name_fr,product_name_en,generic_name,brands,image_front_url,categories,quantity,nutriscore_grade,nutriscore_score';

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
 *
 * The budget goes through the SHARED limiter: a private per-instance `Map`
 * meant 60/min *per lambda*, reset on every cold start, and it never became
 * durable when Upstash was configured for the other routes.
 */
const LOOKUPS_PER_MINUTE = 60;
const GLOBAL_DEADLINE_MS = 12_000;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') ?? '';
  if (!/^[0-9]{8}$/.test(code) && !/^[0-9]{13}$/.test(code)) {
    return NextResponse.json({ status: 0, found: false, product: null, error: 'invalid code' }, { status: 400 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'local';
  const arcjet = await checkArcjet(request);
  if (arcjet.denied) {
    return NextResponse.json(
      { status: 0, found: false, product: null, error: 'blocked' },
      { status: 403 },
    );
  }
  if (await isRateLimited('barcode', ip, LOOKUPS_PER_MINUTE, 60_000)) {
    return NextResponse.json(
      { status: 0, found: false, product: null, error: 'too many lookups' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const cached = cacheGet(code);
  if (cached !== undefined) {
    return NextResponse.json(cached);
  }

  const walk = await walkOffHosts(code);

  if (walk.kind === 'found') {
    const payload = { status: 1, found: true, product: walk.product };
    cacheSet(code, payload);
    return NextResponse.json(payload);
  }
  if (walk.kind === 'not-found') {
    const payload = { status: 0, found: false, product: null };
    cacheSet(code, payload);
    return NextResponse.json(payload);
  }
  // `incomplete` / `failed` are NOT cached: they are retryable, and caching
  // them would turn a one-off upstream hiccup into a five-minute false
  // "not found" (the first-scan bug).
  return NextResponse.json(
    {
      status: 0,
      found: false,
      product: null,
      error: walk.kind === 'incomplete' ? 'lookup incomplete' : 'lookup failed',
    },
    { status: 502 },
  );
}

export type OffWalkResult =
  | { kind: 'found'; product: Record<string, unknown> }
  /** Every instance answered and none carried the code — safe to cache. */
  | { kind: 'not-found' }
  /** Some instances answered "no" but others failed to answer — retryable. */
  | { kind: 'incomplete' }
  /** No instance answered at all — retryable. */
  | { kind: 'failed' };

/**
 * Walk every Open Food Facts instance for a code.
 *
 * "not-found" is only definitive when EVERY instance actually answered. If
 * one was down/slow (e.g. the beauty instance 500s once), it may be the one
 * that carries the product — the walk then reports `incomplete`, which the
 * route answers with a retryable 502 instead of a cached false negative.
 * (First-scan bug: world food answered status 0 while beauty failed, so the
 * walk concluded "not found" and cached it; every retry in the window kept
 * serving the cached miss until a fresh scan on another instance re-walked
 * the hosts.)
 */
export async function walkOffHosts(
  code: string,
  opts?: { deadlineMs?: number; perHostMs?: number },
): Promise<OffWalkResult> {
  const deadlineMs = opts?.deadlineMs ?? GLOBAL_DEADLINE_MS;
  const perHostMs = opts?.perHostMs ?? 6000;
  let notFound = false;
  let hostFailures = 0;
  const deadline = AbortSignal.timeout(deadlineMs);

  for (const base of OFF_HOSTS) {
    if (deadline.aborted) break;
    try {
      const res = await fetch(`${base}${code}.json?fields=${FIELDS}`, {
        // The shorter of the per-host grace and the request-wide deadline, so a
        // slow host cannot stretch one lookup past five sequential timeouts.
        signal: AbortSignal.any([AbortSignal.timeout(perHostMs), deadline]),
        headers: { 'User-Agent': 'SmartJib (course session product lookup)' },
      });
      if (!res.ok) {
        hostFailures += 1;
        continue;
      }
      const body = (await res.json()) as { status?: number; product?: Record<string, unknown> };
      if (body && body.status === 1 && body.product) {
        return { kind: 'found', product: body.product };
      }
      if (body && typeof body.status === 'number') {
        notFound = true;
      } else {
        hostFailures += 1; // 200 but malformed — not a definitive answer
      }
    } catch {
      hostFailures += 1;
      /* try the next host */
    }
  }
  // A deadline abort means the remaining hosts never got to answer.
  if (deadline.aborted) hostFailures += 1;

  if (notFound && hostFailures === 0) return { kind: 'not-found' };
  if (notFound) return { kind: 'incomplete' };
  return { kind: 'failed' };
}
