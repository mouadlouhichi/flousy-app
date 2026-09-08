import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { clearInciLookupCache, lookupInciForBarcode } from '../src/lib/ingredient-lookup-client';

/**
 * Client wrapper for the missing-INCI fallback route.
 *
 * Maps the server's compact JSON into the three UI outcomes, caches the
 * deterministic per-barcode results, and never throws (the scan panel treats
 * any failure as "keep offering paste/OCR").
 */

const realFetch = globalThis.fetch;
type FetchScript = (url: string) => Response | Promise<Response>;

function mockFetch(script: FetchScript): void {
  globalThis.fetch = ((url: string | URL | Request) => Promise.resolve(script(String(url)))) as typeof fetch;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => clearInciLookupCache());

describe('lookupInciForBarcode', () => {
  it('validates the barcode shape locally before any request', async () => {
    let calls = 0;
    mockFetch(() => {
      calls++;
      throw new Error('must not call out');
    });
    for (const invalid of ['123', '6111234567896', 'LOT-6111234567895-X', '٦١١١٢٣٤٥٦٧٨٩٥']) {
      assert.deepEqual(await lookupInciForBarcode(invalid), { kind: 'unavailable' });
    }
    assert.equal(calls, 0);
  });

  it('returns found with the ingredient text on a provider hit', async () => {
    const seen: string[] = [];
    mockFetch((url) => {
      seen.push(url);
      return json(200, { found: true, ingredientsText: 'Aqua, Glycerin, Niacinamide' });
    });
    const out = await lookupInciForBarcode('6111234567895');
    assert.deepEqual(out, { kind: 'found', ingredientsText: 'Aqua, Glycerin, Niacinamide' });
    assert.equal(seen.length, 1);
    assert.equal(seen[0], '/api/inci/lookup?code=6111234567895');
  });

  it('maps found:false + reason not-found to not-found (provider has no list)', async () => {
    mockFetch(() => json(200, { found: false, reason: 'not-found' }));
    assert.deepEqual(await lookupInciForBarcode('6111234567802'), { kind: 'not-found' });
  });

  it('maps provider failures to unavailable (retryable — not "no list")', async () => {
    mockFetch(() => json(502, { found: false, reason: 'lookup-failed' }));
    assert.deepEqual(await lookupInciForBarcode('6111234567819'), { kind: 'unavailable' });

    // No key configured server-side is not a product verdict.
    mockFetch(() => json(200, { found: false, reason: 'not-configured' }));
    assert.deepEqual(await lookupInciForBarcode('6111234567819'), { kind: 'unavailable' });
  });

  it('maps errors and malformed shapes to unavailable (keep paste/OCR)', async () => {
    mockFetch(() => json(500, { found: false, reason: 'error' }));
    assert.deepEqual(await lookupInciForBarcode('6111234567826'), { kind: 'unavailable' });

    mockFetch(() => json(200, { found: true, ingredientsText: '' }));
    assert.deepEqual(await lookupInciForBarcode('6111234567826'), { kind: 'unavailable' });

    mockFetch(() => json(200, { found: 'yes' }));
    assert.deepEqual(await lookupInciForBarcode('6111234567826'), { kind: 'unavailable' });
  });

  it('caches a deterministic result and never refetches the same code', async () => {
    clearInciLookupCache();
    let calls = 0;
    mockFetch(() => {
      calls += 1;
      return json(200, { found: true, ingredientsText: 'Aqua' });
    });
    const first = await lookupInciForBarcode('12345678901231');
    const second = await lookupInciForBarcode('12345678901231');
    assert.deepEqual(first, second);
    assert.equal(calls, 1);
  });

  it('shares one canonical cache entry across equivalent UPC-A and EAN-13 displays', async () => {
    let calls = 0;
    mockFetch((url) => {
      calls += 1;
      assert.equal(url, '/api/inci/lookup?code=036000291452');
      return json(200, { found: true, ingredientsText: 'Aqua' });
    });
    assert.deepEqual(await lookupInciForBarcode('036000291452'), { kind: 'found', ingredientsText: 'Aqua' });
    assert.deepEqual(await lookupInciForBarcode('0036000291452'), { kind: 'found', ingredientsText: 'Aqua' });
    assert.equal(calls, 1);
  });

  it('cancels one subscriber without discarding a shared successful lookup', async () => {
    let resolveFetch!: (response: Response) => void;
    mockFetch(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    const controller = new AbortController();
    const cancelled = lookupInciForBarcode('036000291452', { signal: controller.signal });
    const shared = lookupInciForBarcode('0036000291452');
    controller.abort();
    await assert.rejects(cancelled, (error: unknown) => (error as Error).name === 'AbortError');
    resolveFetch(json(200, { found: true, ingredientsText: 'Aqua, Glycerin' }));
    assert.deepEqual(await shared, { kind: 'found', ingredientsText: 'Aqua, Glycerin' });
  });
});
