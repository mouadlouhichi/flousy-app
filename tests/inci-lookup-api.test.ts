import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/inci/lookup/route';
import { resetMemoryRateLimits } from '../src/lib/server/rate-limit';

/**
 * GET /api/inci/lookup — barcode → INCI fallback.
 *
 * The route is the client-side fallback for a resolved cosmetic whose OBF
 * record has no ingredient text. It must:
 *  - never call the provider without INCI_API_KEY (pure no-op route);
 *  - ask the provider only the barcode and adopt its ingredient text;
 *  - report a clean `not-found` (never a risk verdict) when the provider has
 *    no list;
 *  - reject invalid codes before touching anything.
 */

type FetchCall = { url: string; init?: { headers?: Record<string, string> } };

async function callApi(code: string, ip: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const req = new NextRequest(`http://localhost/api/inci/lookup?code=${code}`, {
    headers: { 'x-forwarded-for': ip },
  });
  const res = await GET(req);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const ENV_KEYS = ['INCI_API_KEY', 'ARCJET_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] as const;
let savedEnv: Record<string, string | undefined>;
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  originalFetch = globalThis.fetch;
  resetMemoryRateLimits();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = originalFetch;
});

describe('GET /api/inci/lookup', () => {
  it('invalidates malformed codes before any lookup', async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('must not call out');
    }) as unknown as typeof fetch;
    const bad = await callApi('123', '10.1.0.1');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.reason, 'invalid code');
    assert.equal(fetchCalls, 0);
  });

  it('is a zero-network no-op when INCI_API_KEY is not configured', async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('no-key run must not call out');
    }) as unknown as typeof fetch;
    const res = await callApi('1000000000009', '10.1.0.2');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { found: false, reason: 'not-configured' });
    assert.equal(fetchCalls, 0);
  });

  it('adopts the vendor ingredient text with the key configured', async () => {
    process.env.INCI_API_KEY = 'sk-test';
    const calls: FetchCall[] = [];
    globalThis.fetch = (async (url: string, init?: { headers?: Record<string, string> }) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          barcode: '2000000000008',
          productName: 'Ultra doux avocat',
          rawInci: ['Aqua', 'Glycerin', 'Niacinamide', 'Parfum.'],
        }),
      };
    }) as unknown as typeof fetch;

    const res = await callApi('2000000000008', '10.1.0.3');
    assert.equal(res.status, 200);
    assert.equal(res.body.found, true);
    assert.equal(res.body.ingredientsText, 'Aqua, Glycerin, Niacinamide, Parfum.');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://inciapi.com/v1/products/2000000000008/safety');
    assert.equal(calls[0].init?.headers?.['X-API-Key'], 'sk-test');
  });

  it('reports a clean not-found when the provider has no INCI list', async () => {
    process.env.INCI_API_KEY = 'sk-test';
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ product: { product_name: 'Unknown product' } }),
    })) as unknown as typeof fetch;

    const res = await callApi('3000000000007', '10.1.0.4');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { found: false, reason: 'not-found' });
  });

  it('fails open on a provider/network error (still a no-risk not-found)', async () => {
    process.env.INCI_API_KEY = 'sk-test';
    globalThis.fetch = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const res = await callApi('4000000000006', '10.1.0.5');
    assert.equal(res.status, 502);
    assert.equal(res.body.found, false);
    assert.equal(res.body.reason, 'lookup-failed');
  });

  it('returns a clean not-found only when a payload came back without INCI', async () => {
    process.env.INCI_API_KEY = 'sk-test';
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ product: { product_name: 'Unknown product' } }),
    })) as unknown as typeof fetch;

    const res = await callApi('5000000000005', '10.1.0.6');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { found: false, reason: 'not-found' });
  });
});
