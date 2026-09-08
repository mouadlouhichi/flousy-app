import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVendorRecognition,
  extractVendorAnalyzeEntries,
  extractVendorInci,
  extractVendorProduct,
  fetchVendorAnalyzeRecognition,
  fetchVendorInci,
  fetchVendorPayload,
  fetchVendorProduct,
  isVendorConfigured,
  VENDOR_INCI_ANALYZE_ENDPOINT,
  VENDOR_INCI_ENDPOINT,
  VENDOR_INCI_SAFETY_PATH,
} from '../src/lib/server/vendor-inci';

type TestEnv = { INCI_API_KEY?: string };
const KEYED: TestEnv = { INCI_API_KEY: 'sk-test' };
const KEYLESS: TestEnv = {};

describe('vendor-inci extractors', () => {
  it('extracts the INCI array from the documented product.details shape', () => {
    const body = {
      product: {
        barcode: '0085275710434',
        name: 'CeraVe Foaming Facial Cleanser',
        details: { inci: ['Aqua', 'Glycerin', 'Niacinamide', 'Parfum.'] },
      },
    };
    assert.equal(extractVendorInci(body), 'Aqua, Glycerin, Niacinamide, Parfum.');
  });

  it('extracts the documented barcode /safety response (top-level rawInci)', () => {
    const body = {
      barcode: '0085275710434',
      rawInci: ['AQUA', 'GLYCERIN', 'NIACINAMIDE', 'CETEARYL ALCOHOL', 'PHENOXYETHANOL'],
      parsedIngredients: [
        { inciName: 'AQUA', safetyLevel: 'safe', found: true },
        { inciName: 'GLYCERIN', safetyLevel: 'safe', found: true },
      ],
      overallSafetyScore: 7.3,
    };
    assert.equal(extractVendorInci(body), 'AQUA, GLYCERIN, NIACINAMIDE, CETEARYL ALCOHOL, PHENOXYETHANOL');
  });

  it('extracts parsedIngredients objects when rawInci is absent/' +
    'null (provider shape drift)', () => {
    const body = {
      barcode: '0085275710434',
      parsedIngredients: [
        { inciName: 'AQUA', safetyLevel: 'safe', found: true },
        { name: 'RETINOL', safetyLevel: 'moderate', found: true },
      ],
    };
    assert.equal(extractVendorInci(body), 'AQUA, RETINOL');
  });

  it('extracts the documented safety product fields (productName/brand)', () => {
    const body = {
      productName: 'CeraVe Foaming Facial Cleanser',
      brand: 'CeraVe',
      rawInci: ['AQUA', 'GLYCERIN'],
    };
    assert.deepEqual(extractVendorProduct(body), {
      name: 'CeraVe Foaming Facial Cleanser',
      brand: 'CeraVe',
      ingredientsText: 'AQUA, GLYCERIN',
    });
  });

  it('falls back to the product.ingredients string', () => {
    const body = { product: { name: 'X', ingredients: '  Aqua, Glycerin  ' } };
    assert.equal(extractVendorInci(body), 'Aqua, Glycerin');
  });

  it('returns null for empty / missing ingredient data', () => {
    assert.equal(extractVendorInci({ product: { name: 'X' } }), null);
    assert.equal(extractVendorInci({ product: { details: { inci: [] } } }), null);
    assert.equal(extractVendorInci({ product: { ingredients: '   ' } }), null);
    assert.equal(extractVendorInci(null), null);
    assert.equal(extractVendorInci({}), null);
  });

  it('caps over-long lists', () => {
    const long = new Array(300).fill('Aqua').join(', ');
    const body = { product: { name: 'X', details: { inci: long.split(', ') } } };
    const out = extractVendorInci(body);
    assert.ok(out && out.length <= 8_000);
  });

  it('extracts a minimal product (name + brand + inci)', () => {
    const body = {
      product: { name: 'Crème', brands: 'Laroche', ingredients: 'Aqua, Glycerin' },
    };
    assert.deepEqual(extractVendorProduct(body), {
      name: 'Crème',
      brand: 'Laroche',
      ingredientsText: 'Aqua, Glycerin',
    });
  });

  it('requires both a name and an INCI list for a vendor product', () => {
    assert.equal(extractVendorProduct({ product: { name: 'X' } }), null);
    assert.equal(extractVendorProduct({ product: { ingredients: 'Aqua' } }), null);
  });
});

describe('vendor-inci fetch', () => {
  function stubFetch(opts: { body?: unknown; ok?: boolean; throwOnCall?: boolean } = {}) {
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
    const fetchImpl = async (url: string, init?: { headers?: Record<string, string> }) => {
      calls.push({ url, headers: init?.headers });
      if (opts.throwOnCall) throw new Error('network down');
      return {
        ok: opts.ok !== false,
        json: async () => opts.body ?? {},
      };
    };
    return { fetchImpl, calls };
  }

  it('never calls the network when no key is configured', async () => {
    const { fetchImpl, calls } = stubFetch({ throwOnCall: true });
    const out = await fetchVendorPayload('6111234567890', KEYLESS, fetchImpl);
    assert.equal(out, null);
    assert.equal(calls.length, 0);
    assert.equal(isVendorConfigured(KEYLESS), false);
  });

  it('sends the key header and returns the payload when configured', async () => {
    const { fetchImpl, calls } = stubFetch({ body: { product: { name: 'X' } } });
    const out = await fetchVendorPayload('6111234567890', KEYED, fetchImpl);
    assert.deepEqual(out, { product: { name: 'X' } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${VENDOR_INCI_ENDPOINT}6111234567890${VENDOR_INCI_SAFETY_PATH}`);
    assert.equal(calls[0].headers?.['X-API-Key'], 'sk-test');
  });

  it('rejects non-barcode codes and fails open on HTTP/network errors', async () => {
    const httpStub = stubFetch({ ok: false });
    assert.equal(await fetchVendorPayload('not-a-code', KEYED, httpStub.fetchImpl), null);
    assert.equal(httpStub.calls.length, 0, 'invalid codes never reach the network');
    assert.equal(await fetchVendorPayload('6111234567890', KEYED, httpStub.fetchImpl), null);
    // Both endpoint variants are tried before giving up.
    assert.equal(httpStub.calls.length, 2, 'HTTP errors return null after both variants');
    assert.equal(httpStub.calls[0].url, `${VENDOR_INCI_ENDPOINT}6111234567890${VENDOR_INCI_SAFETY_PATH}`);
    assert.equal(httpStub.calls[1].url, `${VENDOR_INCI_ENDPOINT}6111234567890`);
    const netStub = stubFetch({ throwOnCall: true });
    assert.equal(await fetchVendorPayload('6111234567890', KEYED, netStub.fetchImpl), null);
    assert.equal(netStub.calls.length, 2, 'network errors return null after both variants');
  });

  it('composes into fetchVendorInci / fetchVendorProduct', async () => {
    const body = {
      product: { name: 'Crème', brands: 'X', ingredients: 'Aqua, Glycerin' },
    };
    const { fetchImpl } = stubFetch({ body });
    assert.equal(await fetchVendorInci('6111234567890', KEYED, fetchImpl), 'Aqua, Glycerin');
    assert.deepEqual(await fetchVendorProduct('6111234567890', KEYED, fetchImpl), {
      name: 'Crème',
      brand: 'X',
      ingredientsText: 'Aqua, Glycerin',
    });
  });

  it('falls back to the plain barcode endpoint when /safety 404s', async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      if (url.endsWith(VENDOR_INCI_SAFETY_PATH)) {
        return { ok: false, json: async () => ({}) };
      }
      return {
        ok: true,
        json: async () => ({ product: { name: 'Crème', details: { inci: ['Aqua', 'Glycerin'] } } }),
      };
    };
    const body = await fetchVendorPayload('6111234567890', KEYED, fetchImpl as never);
    assert.equal(extractVendorInci(body), 'Aqua, Glycerin');
    assert.deepEqual(calls, [
      `${VENDOR_INCI_ENDPOINT}6111234567890${VENDOR_INCI_SAFETY_PATH}`,
      `${VENDOR_INCI_ENDPOINT}6111234567890`,
    ]);
  });
});

describe('vendor analyze (analysis-fallback unit)', () => {
  it('parses the documented parsedIngredients array defensively', () => {
    const body = {
      parsedIngredients: [
        { inciName: 'Phlogiston Essence', safetyLevel: 'safe', safetyScore: 1, found: true },
        { name: 'Unobtainium Complex', safetyLevel: 'warning' },
      ],
    };
    assert.deepEqual(extractVendorAnalyzeEntries(body), [
      { inciName: 'Phlogiston Essence', safetyLevel: 'safe', safetyScore: 1, found: true },
      { inciName: 'Unobtainium Complex', safetyLevel: 'warning' },
    ]);
  });

  it('accepts ingredients / analysis.parsedIngredients shapes and drops junk', () => {
    assert.deepEqual(extractVendorAnalyzeEntries({ ingredients: [{ inciName: 'X', found: false }] }), [
      { inciName: 'X', found: false },
    ]);
    assert.deepEqual(
      extractVendorAnalyzeEntries({ analysis: { parsedIngredients: [{ name: 'Y' }] } }),
      [{ inciName: 'Y' }],
    );
    assert.deepEqual(extractVendorAnalyzeEntries({ parsedIngredients: [{ nope: 1 }, 'junk', null] }), []);
    assert.deepEqual(extractVendorAnalyzeEntries({ parsedIngredients: [] }), []);
    assert.deepEqual(extractVendorAnalyzeEntries(null), []);
    assert.deepEqual(extractVendorAnalyzeEntries({ something: 'else' }), []);
  });

  it('normalizes name keys and adopts only explicit safe entries', () => {
    const map = buildVendorRecognition([
      { inciName: '  phlogiston essence ', safetyLevel: 'Safe' },
      { inciName: 'Unobtainium Complex', safetyLevel: 'unsafe' },
      { inciName: 'Mystery Polymer', safetyLevel: 'warning', safetyScore: 0.4, found: true },
      { inciName: 'GoneBotanical', found: false, safetyLevel: 'safe' },
      { inciName: '', safetyLevel: 'safe' },
    ]);
    assert.equal(map.size, 1);
    const entry = map.get('PHLOGISTON ESSENCE');
    assert.ok(entry, 'normalized key present');
    assert.equal(entry.label, 'PHLOGISTON ESSENCE');
    assert.ok(entry.detail.length > 0 && entry.evidence.length > 0);
  });

  it('never calls the network without a key, and caps the posted list at 300', async () => {
    let calls = 0;
    const boom: Parameters<typeof fetchVendorAnalyzeRecognition>[2] = async () => {
      calls++;
      throw new Error('must not be reached');
    };
    assert.deepEqual([...(await fetchVendorAnalyzeRecognition(['Aqua'], KEYLESS, boom))], []);
    assert.equal(calls, 0);

    const long = Array.from({ length: 500 }, (_, i) => `Xtra ${i}`);
    let posted: unknown[] | null = null;
    const spy: Parameters<typeof fetchVendorAnalyzeRecognition>[2] = async (url, init) => {
      posted = JSON.parse(init?.body ?? '{}').ingredients;
      assert.equal(url, VENDOR_INCI_ANALYZE_ENDPOINT);
      return { ok: true, json: async () => ({ parsedIngredients: [] }) };
    };
    await fetchVendorAnalyzeRecognition(long, KEYED, spy);
    assert.notEqual(posted, null, 'the spy must have run');
    assert.equal((posted as unknown as unknown[]).length, 300);
  });

  it('fails open on HTTP errors, thrown network errors, and hostile payloads', async () => {
    const httpErr = async () => ({ ok: false, json: async () => ({}) });
    assert.equal((await fetchVendorAnalyzeRecognition(['Aqua'], KEYED, httpErr)).size, 0);
    const netErr = async () => {
      throw new Error('network down');
    };
    assert.equal((await fetchVendorAnalyzeRecognition(['Aqua'], KEYED, netErr)).size, 0);
    const junk = async () => ({ ok: true, json: async () => ({ parsedIngredients: 'oops' }) });
    assert.equal((await fetchVendorAnalyzeRecognition(['Aqua'], KEYED, junk)).size, 0);
  });
});
