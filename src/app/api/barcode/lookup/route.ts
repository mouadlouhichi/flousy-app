import { NextResponse, type NextRequest } from 'next/server';
import { isRateLimited } from '@/lib/server/rate-limit';
import { checkArcjet } from '@/lib/server/arcjet';
import { fetchVendorInci, fetchVendorProduct, isVendorConfigured } from '@/lib/server/vendor-inci';
import { parseGtin } from '@/lib/gtin';
import { PRODUCT_LOOKUP_FIELDS, type LookupDatabase } from '@/lib/product-lookup';
import type { ProductDomain } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HostDefinition {
  base: string;
  database: Exclude<LookupDatabase, 'vendor' | 'unknown'>;
}

const OFF_HOSTS: readonly HostDefinition[] = [
  { base: 'https://world.openfoodfacts.org/api/v2/product/', database: 'off' },
  { base: 'https://ma-fr.openfoodfacts.org/api/v2/product/', database: 'off' },
  { base: 'https://ma.openfoodfacts.org/api/v2/product/', database: 'off' },
  { base: 'https://world.openbeautyfacts.org/api/v2/product/', database: 'obf' },
  { base: 'https://fr.openbeautyfacts.org/api/v2/product/', database: 'obf' },
  { base: 'https://world.openpetfoodfacts.org/api/v2/product/', database: 'opff' },
  { base: 'https://world.openproductsfacts.org/api/v2/product/', database: 'opf' },
];

const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 100;
const LOOKUPS_PER_MINUTE = 60;
const GLOBAL_DEADLINE_MS = 10_000;
const SOURCE_WALK_BUDGET_MS = 6_500;
const cache = new Map<string, { at: number; body: unknown }>();

/** Clears only the bounded in-process catalog response cache. Exported for
 * deterministic route boundary tests and safe to call in server maintenance. */
export function clearBarcodeLookupCache(): void {
  cache.clear();
}

function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.body;
}

function cacheSet(key: string, body: unknown): void {
  cache.delete(key);
  cache.set(key, { at: Date.now(), body });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function response(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: status === 200
      ? { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' }
      : { 'Cache-Control': 'no-store' },
  });
}

function isDomain(value: string | null): value is ProductDomain {
  return value === 'food' || value === 'cosmetic' || value === 'household' || value === 'pet' || value === 'unknown';
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const rawCode = url.searchParams.get('code') ?? '';
  const parsed = parseGtin({
    rawValue: rawCode,
    format: url.searchParams.get('format') ?? undefined,
    source: 'api',
  });
  if (!parsed.ok) {
    return response({ status: 0, found: false, product: null, error: 'invalid code' }, 400);
  }
  const code = parsed.value.lookupCode;
  const domainHint = isDomain(url.searchParams.get('domain')) ? url.searchParams.get('domain') as ProductDomain : undefined;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || 'local';

  const arcjet = await checkArcjet(request);
  if (arcjet.denied) return response({ status: 0, found: false, product: null, error: 'blocked' }, 403);
  if (await isRateLimited('barcode', ip, LOOKUPS_PER_MINUTE, 60_000)) {
    return NextResponse.json(
      { status: 0, found: false, product: null, error: 'too many lookups' },
      { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } },
    );
  }

  // Source priority changes with the requested domain, so domain is part of
  // response identity. Language is mapped client-side from the same bounded
  // multilingual payload and therefore does not fragment this cache.
  const cacheDomain = domainHint && domainHint !== 'unknown' ? domainHint : 'auto';
  const cacheKey = `${parsed.value.gtin14}\u0001${cacheDomain}`;
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return response(cached);

  const globalSignal = AbortSignal.any([request.signal, AbortSignal.timeout(GLOBAL_DEADLINE_MS)]);
  const walk = await walkOffHosts(code, {
    deadlineMs: SOURCE_WALK_BUDGET_MS,
    signal: globalSignal,
    domainHint,
  });

  if (walk.kind === 'found') {
    const product = { ...walk.product };
    const sourceUrl = `${walk.base}${encodeURIComponent(code)}`;
    const likelyCosmetic = walk.database === 'obf' || looksLikeBeauty(product);
    if (likelyCosmetic && isVendorConfigured() && !hasInciText(product) && !globalSignal.aborted) {
      const inci = await fetchVendorInci(code, process.env, undefined, globalSignal);
      if (inci) {
        attachInci(product, inci);
        product.ingredients_provenance = 'INCI API (inciapi.com)';
      }
    }
    const payload = {
      status: 1,
      found: true,
      product,
      lookupSource: walk.database,
      sourceUrl,
      retrievedAt: new Date().toISOString(),
    };
    cacheSet(cacheKey, payload);
    return response(payload);
  }

  if (walk.kind === 'not-found' && isVendorConfigured() && !globalSignal.aborted) {
    const vendor = await fetchVendorProduct(code, process.env, undefined, globalSignal);
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
        lookupSource: 'vendor' as const,
        sourceUrl: 'https://inciapi.com/',
        retrievedAt: new Date().toISOString(),
      };
      cacheSet(cacheKey, payload);
      return response(payload);
    }
  }

  if (walk.kind === 'not-found') {
    const payload = { status: 0, found: false, product: null };
    cacheSet(cacheKey, payload);
    return response(payload);
  }
  return response({
    status: 0,
    found: false,
    product: null,
    error: walk.kind === 'incomplete' ? 'lookup incomplete' : 'lookup failed',
  }, 502);
}

type OffProduct = Record<string, unknown>;

function looksLikeBeauty(product: OffProduct): boolean {
  const values = ['categories', 'categories_tags', 'labels_tags', 'product_type']
    .flatMap((key) => {
      const value = product[key];
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
      return typeof value === 'string' ? [value] : [];
    })
    .join(' ')
    .toLowerCase();
  // Open Products Facts is generic and is intentionally not a beauty signal.
  return values.includes('open-beauty-facts') || values.includes('cosmetic') || values.includes('beauty');
}

function hasInciText(product: OffProduct): boolean {
  return ['ingredients_text', 'ingredients_text_en', 'ingredients_text_fr', 'ingredients_text_es', 'ingredients_text_ar']
    .some((key) => typeof product[key] === 'string' && String(product[key]).trim().length > 0);
}

function attachInci(product: OffProduct, inciText: string): void {
  product.ingredients_text = inciText;
}

export type OffWalkResult =
  | { kind: 'found'; product: Record<string, unknown>; database: HostDefinition['database']; base: string }
  | { kind: 'not-found' }
  | { kind: 'incomplete' }
  | { kind: 'failed' };

interface HostAttempt {
  host: HostDefinition;
  status: 'found' | 'not-found' | 'failed';
  product?: Record<string, unknown>;
}

function sourcePriority(domain: ProductDomain | undefined): HostDefinition['database'][] {
  if (domain === 'cosmetic') return ['obf', 'opf', 'off', 'opff'];
  if (domain === 'pet') return ['opff', 'opf', 'off', 'obf'];
  if (domain === 'household') return ['opf', 'off', 'obf', 'opff'];
  return ['off', 'opff', 'obf', 'opf'];
}

/** Query independent databases concurrently under one deadline. */
export async function walkOffHosts(
  code: string,
  opts?: { deadlineMs?: number; perHostMs?: number; signal?: AbortSignal; domainHint?: ProductDomain },
): Promise<OffWalkResult> {
  const deadlineMs = opts?.deadlineMs ?? SOURCE_WALK_BUDGET_MS;
  const perHostMs = opts?.perHostMs ?? deadlineMs;
  const deadline = AbortSignal.timeout(Math.max(1, deadlineMs));
  const sharedSignal = opts?.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;

  const attempts = await Promise.all(OFF_HOSTS.map(async (host): Promise<HostAttempt> => {
    try {
      const signal = AbortSignal.any([sharedSignal, AbortSignal.timeout(Math.max(1, perHostMs))]);
      const upstream = `${host.base}${encodeURIComponent(code)}.json?fields=${PRODUCT_LOOKUP_FIELDS}`;
      const result = await fetch(upstream, {
        signal,
        headers: { 'User-Agent': 'Flousy product resolver; https://github.com/mouadlouhichi/flousy-app' },
      });
      if (!result.ok) return { host, status: 'failed' };
      const body = await result.json() as { status?: number; product?: Record<string, unknown> };
      if (body.status === 1 && body.product) return { host, status: 'found', product: body.product };
      if (body.status === 0) return { host, status: 'not-found' };
      return { host, status: 'failed' };
    } catch {
      return { host, status: 'failed' };
    }
  }));

  const priority = sourcePriority(opts?.domainHint);
  const found = attempts
    .filter((attempt): attempt is HostAttempt & { product: Record<string, unknown> } => attempt.status === 'found' && Boolean(attempt.product))
    .sort((a, b) => priority.indexOf(a.host.database) - priority.indexOf(b.host.database))[0];
  if (found) {
    return {
      kind: 'found',
      product: found.product,
      database: found.host.database,
      base: found.host.base,
    };
  }
  const failures = attempts.filter((attempt) => attempt.status === 'failed').length;
  const misses = attempts.filter((attempt) => attempt.status === 'not-found').length;
  if (misses === attempts.length) return { kind: 'not-found' };
  if (misses > 0 && failures > 0) return { kind: 'incomplete' };
  return { kind: 'failed' };
}
