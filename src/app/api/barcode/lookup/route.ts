import { NextResponse, type NextRequest } from 'next/server';
import { isRateLimited } from '@/lib/server/rate-limit';
import { checkArcjet } from '@/lib/server/arcjet';
import { fetchVendorInci, fetchVendorProduct, isVendorConfigured } from '@/lib/server/vendor-inci';

/**
 * Barcode lookup proxy — Open Food Facts family, server-side fetch.
 *
 * The client tries the OFF/OBF APIs directly first; this route is the
 * fallback when the browser cannot reach them (CORS policies, restrictive
 * networks), and the enrichment point for cosmetics whose crowd-sourced
 * record has no INCI list yet.
 *
 * Ordering: world OFF → Morocco OFF → world OBF → French OBF (the biggest
 * European cosmetics mirror, which covers the French brands common on
 * Moroccan shelves) → world Open Products Facts.
 *
 * Enrichment (only when COSMETIC_INCI_API_KEY is configured — see
 * src/lib/server/vendor-inci.ts):
 * - a product found on a beauty/OPF mirror that still lacks an INCI list is
 *   sent to the vendor to fill the ingredient text;
 * - a code NO OFF-family mirror knows is asked of the vendor as a last
 *   resort (name + INCI) before the manual-entry fallback.
 * The vendor is only ever an INCI/name source — scoring stays local and
 * deterministic in /api/inci/analyze.
 *
 * The response keeps BOTH `status` (OFF v2 shape) and `found` (historical
 * proxy shape) so the client mapper never mis-reads a hit as "not found".
 * Stores no user data — barcodes only — in a small in-memory LRU.
 */

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
 * Each uncached lookup walks up to six upstream hosts, and an unreachable host
 * burns the full per-request timeout before the next is tried — so one client
 * can hold an edge function for tens of seconds at a time. The route is
 * unauthenticated by design (it returns public product data, no user data),
 * which makes a per-IP budget plus one shared deadline the only bound.
 */
const LOOKUPS_PER_MINUTE = 60;
const GLOBAL_DEADLINE_MS = 12_000;

type OffProduct = Record<string, unknown>;

function hasInciText(product: OffProduct | null | undefined): boolean {
  if (!product) return false;
  return (
    ['ingredients_text', 'ingredients_text_en', 'ingredients_text_fr', 'ingredients_text_es', 'ingredients_text_ar']
      .some((key) => {
        const value = product[key];
        return typeof value === 'string' && value.trim().length > 0;
      })
  );
}

function attachInci(product: OffProduct, inciText: string): void {
  product.ingredients_text = inciText;
  if (!product.ingredients_text_en) product.ingredients_text_en = inciText;
}

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

  let notFound = false;
  const deadline = AbortSignal.timeout(GLOBAL_DEADLINE_MS);

  for (const { base, beauty } of OFF_HOSTS) {
    if (deadline.aborted) break;
    try {
      const res = await fetch(`${base}${code}.json?fields=${FIELDS}`, {
        // The shorter of the per-host grace and the request-wide deadline, so a
        // slow host cannot stretch one lookup past six sequential timeouts.
        signal: AbortSignal.any([AbortSignal.timeout(6000), deadline]),
        headers: { 'User-Agent': 'SmartJib (course session product lookup)' },
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { status?: number; product?: OffProduct };
      if (body && body.status === 1 && body.product) {
        const product = body.product;
        // A beauty mirror hit that lacks INCI text → ask the vendor to fill it
        // (no-op when no vendor key is configured).
        if (beauty && !hasInciText(product) && isVendorConfigured()) {
          const inci = await fetchVendorInci(code);
          if (inci) attachInci(product, inci);
        }
        const payload = { status: 1, found: true, product };
        cacheSet(code, payload);
        return NextResponse.json(payload);
      }
      if (body && typeof body.status === 'number') notFound = true;
    } catch {
      /* try the next host */
    }
  }

  // Last resort before manual entry: nobody in the OFF family knew the code,
  // so ask the vendor whether it has the product (name + INCI).
  if (notFound && isVendorConfigured()) {
    try {
      const vendor = await fetchVendorProduct(code);
      if (vendor) {
        const payload = {
          status: 1,
          found: true,
          product: {
            code,
            product_name: vendor.name,
            ...(vendor.brand ? { brands: vendor.brand } : {}),
            ingredients_text: vendor.ingredientsText,
          },
        };
        cacheSet(code, payload);
        return NextResponse.json(payload);
      }
    } catch {
      /* fall through to not-found */
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
