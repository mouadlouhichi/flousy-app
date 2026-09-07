import { NextResponse, type NextRequest } from 'next/server';
import { isRateLimited } from '@/lib/server/rate-limit';
import { checkArcjet } from '@/lib/server/arcjet';

/**
 * INCI_API lookup proxy — server-side fetch, the API key never leaves the
 * server (free key from https://inciapi.com/dashboard/api-keys, set as
 * INCI_API_KEY in Vercel / .env.local).
 *
 * Fallback source for barcodes the OFF/OBF datasets don't know — or know
 * without a transcribed INCI list: inciapi.com resolves beauty products by
 * barcode and returns the ingredient list, which drives the quality score.
 *
 * `INCI_API_KEY` unset => the fallback is silently disabled (found:false),
 * which the client mapper treats as a plain miss.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INCI_API_BASE = 'https://inciapi.com';
const UPSTREAM_TIMEOUT_MS = 8000;
const LOOKUPS_PER_MINUTE = 30;

// Ingredient lists rarely change — cache longer than the OFF proxy does.
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map<string, { at: number; body: unknown }>();

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
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') ?? '';
  if (!/^[0-9]{8}$/.test(code) && !/^[0-9]{13}$/.test(code)) {
    return NextResponse.json({ found: false, error: 'invalid code' }, { status: 400 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'local';
  const arcjet = await checkArcjet(request);
  if (arcjet.denied) {
    return NextResponse.json({ found: false, error: 'blocked' }, { status: 403 });
  }
  if (await isRateLimited('inci', ip, LOOKUPS_PER_MINUTE, 60_000)) {
    return NextResponse.json(
      { found: false, error: 'too many lookups' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const apiKey = process.env.INCI_API_KEY;
  if (!apiKey) {
    // Fallback disabled — the client treats this as a plain miss.
    return NextResponse.json({ found: false, error: 'inci api key not configured' });
  }

  const cached = cacheGet(code);
  if (cached !== undefined) {
    return NextResponse.json(cached);
  }

  try {
    const res = await fetch(`${INCI_API_BASE}/v1/products/${code}`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
    });
    if (!res.ok) {
      return NextResponse.json(
        { found: false, error: 'inci lookup failed' },
        { status: res.status >= 500 ? 502 : 404 },
      );
    }
    const body = (await res.json()) as {
      product?: {
        name?: unknown;
        brand?: unknown;
        category?: unknown;
        imageUrls?: unknown;
        ingredients?: unknown;
        details?: { inci?: unknown };
      };
    };
    const p = body?.product;
    const inciList = ((): string[] => {
      const raw = p?.details?.inci;
      const source: unknown[] | undefined = Array.isArray(raw)
        ? raw
        : typeof p?.ingredients === 'string'
          ? p.ingredients.split(',')
          : undefined;
      return (source ?? []).map((part) => String(part).trim()).filter(Boolean);
    })();

    if (!p || typeof p.name !== 'string' || !p.name.trim()) {
      const payload = { found: false };
      cacheSet(code, payload);
      return NextResponse.json(payload);
    }

    const category = Array.isArray(p.category)
      ? p.category[0]
      : typeof p.category === 'string'
        ? p.category
        : undefined;
    const imageUrl = Array.isArray(p.imageUrls) ? p.imageUrls[0] : undefined;

    const payload = {
      found: true,
      product: {
        name: p.name.trim(),
        ...(typeof p.brand === 'string' && p.brand.trim() ? { brand: p.brand.trim() } : {}),
        ...(typeof category === 'string' && category.trim() ? { category: category.trim() } : {}),
        ...(typeof imageUrl === 'string' && imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
        ...(inciList.length > 0 ? { ingredients: inciList } : {}),
      },
    };
    cacheSet(code, payload);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ found: false, error: 'inci lookup failed' }, { status: 502 });
  }
}
