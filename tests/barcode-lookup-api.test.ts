import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  GET,
  clearBarcodeLookupCache,
} from '../src/app/api/barcode/lookup/route';
import { resetMemoryRateLimits } from '../src/lib/server/rate-limit';

const ENV_KEYS = ['INCI_API_KEY', 'ARCJET_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] as const;
const originalFetch = globalThis.fetch;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  clearBarcodeLookupCache();
  resetMemoryRateLimits();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function call(query: string, ip: string) {
  const response = await GET(new NextRequest(`http://localhost/api/barcode/lookup?${query}`, {
    headers: { 'x-forwarded-for': ip },
  }));
  return {
    status: response.status,
    cacheControl: response.headers.get('cache-control'),
    body: await response.json() as Record<string, unknown>,
  };
}

function databaseFor(url: string): 'off' | 'obf' | 'opff' | 'opf' {
  if (url.includes('openbeautyfacts')) return 'obf';
  if (url.includes('openpetfoodfacts')) return 'opff';
  if (url.includes('openproductsfacts')) return 'opf';
  return 'off';
}

describe('GET /api/barcode/lookup strict identity and cache context', () => {
  it('rejects unsupported length, checksum, localized API digits, and ambiguous GS1-128 before network work', async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      throw new Error('invalid input must not reach an upstream');
    }) as typeof fetch;

    for (const [index, query] of [
      'code=123',
      'code=4006381333932',
      `code=${encodeURIComponent('٤٠٠٦٣٨١٣٣٣٩٣١')}`,
      'code=010400638133393117260908&format=GS1_128',
      'code=4006381333931&format=EAN_8',
    ].entries()) {
      const result = await call(query, `10.20.0.${index + 1}`);
      assert.equal(result.status, 400, query);
      assert.equal(result.body.found, false);
      assert.equal(result.body.error, 'invalid code');
      assert.equal(result.cacheControl, 'no-store');
    }
    assert.equal(fetches, 0);
  });

  it('expands UPC-E only when the API supplies explicit UPC-E symbology', async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      urls.push(url);
      return new Response(JSON.stringify({
        status: databaseFor(url) === 'off' ? 1 : 0,
        ...(databaseFor(url) === 'off' ? { product: { product_name: 'Expanded UPC product' } } : {}),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const ambiguous = await call('code=04210007', '10.21.0.1');
    assert.equal(ambiguous.status, 400, 'bare 8 digits must retain EAN-8 semantics');
    assert.equal(urls.length, 0);

    const expanded = await call('code=04210007&format=UPC_E', '10.21.0.2');
    assert.equal(expanded.status, 200);
    assert.equal(expanded.body.found, true);
    assert.equal(expanded.body.lookupSource, 'off');
    assert.ok(urls.length > 0);
    assert.ok(urls.every((url) => url.includes('/042000001007.json?')), 'upstreams must receive expanded UPC-A identity');
  });

  it('shares canonical GTIN-14 cache entries across equivalent display formats', async () => {
    let fetches = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      fetches += 1;
      const url = String(input);
      return new Response(JSON.stringify({
        status: databaseFor(url) === 'off' ? 1 : 0,
        ...(databaseFor(url) === 'off' ? { product: { product_name: 'Canonical product' } } : {}),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const upca = await call('code=012345678905&format=UPC_A&domain=food', '10.22.0.1');
    assert.equal(upca.body.found, true);
    assert.equal(fetches, 7);
    const ean13 = await call('code=0012345678905&format=EAN_13&domain=food', '10.22.0.2');
    assert.equal(ean13.body.found, true);
    assert.equal(fetches, 7, 'equivalent canonical identity should use one bounded cache entry');
  });

  it('keeps source-priority domain in cache identity', async () => {
    let fetches = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      fetches += 1;
      const url = String(input);
      const database = databaseFor(url);
      const product = database === 'off'
        ? { product_name: 'Food record', product_type: 'food' }
        : database === 'obf'
          ? { product_name: 'Cosmetic record', product_type: 'cosmetic' }
          : null;
      return new Response(JSON.stringify(product
        ? { status: 1, product }
        : { status: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const food = await call('code=4006381333931&domain=food', '10.23.0.1');
    assert.equal(food.body.lookupSource, 'off');
    assert.equal((food.body.product as Record<string, unknown>).product_name, 'Food record');
    assert.equal(fetches, 7);

    const cosmetic = await call('code=4006381333931&domain=cosmetic', '10.23.0.2');
    assert.equal(cosmetic.body.lookupSource, 'obf');
    assert.equal((cosmetic.body.product as Record<string, unknown>).product_name, 'Cosmetic record');
    assert.equal(fetches, 14, 'domain-specific source priority must not reuse a food-context response');

    await call('code=4006381333931&domain=cosmetic&lang=ar', '10.23.0.3');
    assert.equal(fetches, 14, 'language selection maps the same multilingual payload client-side');
  });

  it('omits oversized provider fields whole before caching the proxy response', async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      const found = databaseFor(url) === 'off';
      return new Response(JSON.stringify({
        status: found ? 1 : 0,
        ...(found ? { product: {
          product_name: 'Bounded product',
          quantity: '1 L',
          ingredients_text: 'A'.repeat(12_001),
          allergens_tags: new Array(51).fill('en:milk'),
          categories_tags: ['x'.repeat(101)],
          nutriscore_score: 10_000,
        } } : {}),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const result = await call('code=4006381333931&domain=food', '10.23.1.1');
    assert.equal(result.status, 200);
    const product = result.body.product as Record<string, unknown>;
    assert.equal(product.product_name, 'Bounded product');
    assert.equal(product.quantity, '1 L');
    assert.equal(product.ingredients_text, undefined);
    assert.equal(product.allergens_tags, undefined);
    assert.equal(product.categories_tags, undefined);
    assert.equal(product.nutriscore_score, undefined);
  });

  it('distinguishes definitive all-source misses from incomplete upstream evidence', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ status: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
    const miss = await call('code=96385074', '10.24.0.1');
    assert.equal(miss.status, 200);
    assert.deepEqual(miss.body, { status: 0, found: false, product: null });

    clearBarcodeLookupCache();
    let index = 0;
    globalThis.fetch = (async () => {
      index += 1;
      return index === 1
        ? new Response('upstream error', { status: 503 })
        : new Response(JSON.stringify({ status: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    const incomplete = await call('code=96385074', '10.24.0.2');
    assert.equal(incomplete.status, 502);
    assert.equal(incomplete.body.error, 'lookup incomplete');
    assert.equal(incomplete.cacheControl, 'no-store');
  });
});
