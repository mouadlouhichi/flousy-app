import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractVendorInci,
  extractVendorProduct,
  fetchVendorInci,
  fetchVendorPayload,
  fetchVendorProduct,
  isVendorConfigured,
  VENDOR_INCI_ENDPOINT,
} from '../src/lib/server/vendor-inci';

type TestEnv = { COSMETIC_INCI_API_KEY?: string };
const KEYED: TestEnv = { COSMETIC_INCI_API_KEY: 'sk-test' };
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
    assert.equal(calls[0].url, `${VENDOR_INCI_ENDPOINT}6111234567890`);
    assert.equal(calls[0].headers?.['X-API-Key'], 'sk-test');
  });

  it('rejects non-barcode codes and fails open on HTTP/network errors', async () => {
    const httpStub = stubFetch({ ok: false });
    assert.equal(await fetchVendorPayload('not-a-code', KEYED, httpStub.fetchImpl), null);
    assert.equal(httpStub.calls.length, 0, 'invalid codes never reach the network');
    assert.equal(await fetchVendorPayload('6111234567890', KEYED, httpStub.fetchImpl), null);
    assert.equal(httpStub.calls.length, 1, 'HTTP errors return null');
    const netStub = stubFetch({ throwOnCall: true });
    assert.equal(await fetchVendorPayload('6111234567890', KEYED, netStub.fetchImpl), null);
    assert.equal(netStub.calls.length, 1, 'network errors return null');
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
});
