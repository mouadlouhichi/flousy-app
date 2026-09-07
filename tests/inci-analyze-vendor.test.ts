import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/inci/analyze/route';

/**
 * Integration tests for the vendor coverage fallback of POST /api/inci/analyze.
 *
 * Behaviour under test:
 *  - no COSMETIC_INCI_API_KEY ⇒ the route is pure-local and never calls out;
 *  - a key + unrecognized names ⇒ unrecognized raws are POSTed to the provider
 *    and only its "safe" entries are adopted (`vendorEnriched: true`);
 *  - provider failures ⇒ identical to the pure-local result (fail-open);
 *  - a fully recognized list never triggers a vendor call.
 *
 * Global state (process.env + globalThis.fetch) is snapshotted per test; the
 * route reads the env lazily at call time and uses the global fetch by default.
 */

const UNKNOWN_TEXT = 'Aqua, Glycerin, Phlogiston Essence, Unobtainium Complex';

type FetchCall = { url: string; init?: { headers?: Record<string, string>; body?: string } };

async function callApi(text: string, ip: string): Promise<Record<string, unknown>> {
  const req = new NextRequest('http://localhost/api/inci/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ inciText: text, form: 'leave-on' }),
  });
  const res = await POST(req);
  assert.equal(res.status, 200);
  return (await res.json()) as Record<string, unknown>;
}

function makeFetchStub(handler: (call: FetchCall) => Promise<unknown> | unknown) {
  const calls: FetchCall[] = [];
  const stub = async (url: string, init?: { headers?: Record<string, string>; body?: string }) => {
    const call = { url, init };
    calls.push(call);
    return { ok: true, json: async () => handler(call) };
  };
  return { calls, stub };
}

const ENV_KEYS = [
  'COSMETIC_INCI_API_KEY',
  'ARCJET_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const;

let savedEnv: Record<string, string | undefined>;
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = originalFetch;
});

describe('POST /api/inci/analyze vendor fallback', () => {
  it('never calls the vendor without a key (pure-local result)', async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('no-key run must not call out');
    }) as unknown as typeof fetch;
    const res = await callApi(UNKNOWN_TEXT, '10.1.0.1');
    assert.equal(fetchCalls, 0);
    assert.equal(res.vendorEnriched, undefined);
    assert.equal(res.recognized, 2);
    assert.equal((res.ingredients as { tier: string | null }[]).filter((i) => i.tier === null).length, 2);
  });

  it('posts only unrecognized names and adopts safe entries (vendorEnriched)', async () => {
    process.env.COSMETIC_INCI_API_KEY = 'sk-test';
    const { calls, stub } = makeFetchStub((call) => {
      assert.equal(call.url, 'https://inciapi.com/v1/analyze');
      assert.equal(call.init?.headers?.['X-API-Key'], 'sk-test');
      const body = JSON.parse(call.init?.body ?? '{}') as { ingredients: string[] };
      assert.deepEqual(body.ingredients, ['Phlogiston Essence', 'Unobtainium Complex']);
      return {
        parsedIngredients: [
          { inciName: 'Phlogiston Essence', safetyLevel: 'safe', found: true },
          { inciName: 'Unobtainium Complex', safetyLevel: 'unsafe', found: true },
        ],
      };
    });
    globalThis.fetch = stub as unknown as typeof globalThis.fetch;

    const res = await callApi(UNKNOWN_TEXT, '10.1.0.2');
    assert.equal(calls.length, 1);
    assert.equal(res.vendorEnriched, true);
    assert.equal(res.recognized, 3);
    assert.equal(res.total, 4);
    const remaining = (res.ingredients as { tier: string | null; raw: string }[]).filter(
      (i) => i.tier === null,
    );
    assert.deepEqual(remaining.map((i) => i.raw), ['Unobtainium Complex']);
  });

  it('fails open: a vendor error leaves the pure-local result unchanged', async () => {
    const keyed = () => {
      process.env.COSMETIC_INCI_API_KEY = 'sk-test';
    };
    // Baseline (no key).
    const plain = await callApi(UNKNOWN_TEXT, '10.1.0.3');

    // HTTP error.
    keyed();
    globalThis.fetch = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    const httpRes = await callApi(UNKNOWN_TEXT, '10.1.0.4');
    assert.equal(httpRes.vendorEnriched, undefined);
    assert.equal(JSON.stringify(httpRes), JSON.stringify(plain));

    // Network error.
    globalThis.fetch = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const netRes = await callApi(UNKNOWN_TEXT, '10.1.0.5');
    assert.equal(netRes.vendorEnriched, undefined);
    assert.equal(JSON.stringify(netRes), JSON.stringify(plain));
  });

  it('never calls the vendor when the local snapshot already covers the list', async () => {
    process.env.COSMETIC_INCI_API_KEY = 'sk-test';
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('full coverage must not call out');
    }) as unknown as typeof fetch;
    const res = await callApi('Aqua, Glycerin, Niacinamide', '10.1.0.6');
    assert.equal(fetchCalls, 0);
    assert.equal(res.recognized, 3);
    assert.equal(res.coverage, 1);
  });
});
