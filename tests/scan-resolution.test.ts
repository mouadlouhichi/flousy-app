import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveScan } from '../src/lib/scan-resolution';
import type { Product } from '../src/lib/store';

const NOW = new Date('2026-09-08T12:00:00.000Z');
const candidate = {
  rawValue: '4006381333931',
  format: 'EAN_13',
  source: 'camera-native' as const,
};

function product(extra: Partial<Product> = {}): Product {
  return {
    barcode: '4006381333931',
    gtin14: '04006381333931',
    name: 'Locally corrected name',
    category: 'Face creams',
    source: 'manual',
    domain: 'cosmetic',
    domainSource: 'user',
    provenance: {
      name: { source: 'manual', retrievedAt: '2026-09-01T00:00:00.000Z' },
      category: { source: 'obf', retrievedAt: '2026-08-01T00:00:00.000Z' },
    },
    retrievedAt: '2026-08-01T00:00:00.000Z',
    staleAfter: '2026-08-08T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...extra,
  };
}

describe('unified scan resolution', () => {
  it('rejects invalid checksums before catalog, seed, or network work', async () => {
    let calls = 0;
    const result = await resolveScan({
      candidate: { ...candidate, rawValue: '4006381333932' },
      catalog: [product()],
      lookupSeed: () => { calls += 1; return { name: 'seed' }; },
      lookupRemote: async () => { calls += 1; return { kind: 'not-found' }; },
    });
    assert.deepEqual(result, {
      kind: 'invalid',
      candidate: { ...candidate, rawValue: '4006381333932' },
      error: 'bad-checksum',
    });
    assert.equal(calls, 0);
  });

  it('matches catalog entries by canonical GTIN-14 across display formats', async () => {
    const result = await resolveScan({
      candidate: { rawValue: '0012345678905', format: 'EAN_13', source: 'manual' },
      catalog: [product({
        barcode: '012345678905',
        gtin14: '00012345678905',
        name: 'UPC product',
        staleAfter: '2026-10-01T00:00:00.000Z',
      })],
      now: NOW,
    });
    assert.equal(result.kind, 'found');
    if (result.kind === 'found') {
      assert.equal(result.source, 'catalog');
      assert.equal(result.product.name, 'UPC product');
      assert.equal(result.product.gtin14, '00012345678905');
      assert.equal(result.canonical.lookupCode, '0012345678905');
      assert.equal(result.stale, false);
    }
  });

  it('returns stale catalog data immediately, then fills provider fields without overwriting user corrections', async () => {
    const result = await resolveScan({
      candidate,
      catalog: [product()],
      now: NOW,
      lookupRemote: async (code, options) => {
        assert.equal(code, '4006381333931');
        assert.equal(options.lang, 'fr');
        assert.equal(options.domainHint, 'cosmetic');
        assert.equal(options.signal.aborted, false);
        return {
          kind: 'found',
          product: {
            name: 'Provider name must not win',
            brand: 'Provider brand',
            category: 'Moisturizers',
            ingredientsText: 'Aqua, Glycerin',
            domain: 'cosmetic',
            novaGroup: 4,
            source: 'obf',
            retrievedAt: '2026-09-08T12:00:00.000Z',
            provenance: {
              name: { source: 'obf', retrievedAt: '2026-09-08T12:00:00.000Z' },
              brand: { source: 'obf', retrievedAt: '2026-09-08T12:00:00.000Z' },
              ingredientsText: { source: 'obf', retrievedAt: '2026-09-08T12:00:00.000Z' },
            },
          },
        };
      },
      lang: 'fr',
      domainHint: 'cosmetic',
    });
    assert.equal(result.kind, 'found');
    if (result.kind !== 'found') return;
    assert.equal(result.stale, true);
    assert.equal(result.product.name, 'Locally corrected name');
    assert.ok(result.revalidate);
    const refreshed = await result.revalidate;
    assert.ok(refreshed);
    assert.equal(refreshed.name, 'Locally corrected name');
    assert.equal(refreshed.brand, 'Provider brand');
    assert.equal(refreshed.ingredientsText, 'Aqua, Glycerin');
    // The NOVA group is provider-owned: a refresh fills the gap and records
    // where it came from, like every other provider field.
    assert.equal(refreshed.novaGroup, 4);
    assert.equal(refreshed.provenance.novaGroup?.source, 'obf');
    assert.equal(refreshed.provenance.name?.source, 'manual');
    assert.equal(refreshed.provenance.brand?.source, 'obf');
    assert.equal(refreshed.domain, 'cosmetic');
    assert.equal(refreshed.domainSource, 'user', 'stored user domain remains authoritative');
  });

  it('keeps generic Open Products Facts provenance separate from domain inference', async () => {
    const result = await resolveScan({
      candidate,
      catalog: [],
      lookupRemote: async () => ({
        kind: 'found',
        product: {
          name: 'Multipurpose item',
          source: 'opf',
          sourceDatabase: 'opf',
          domain: 'unknown',
          retrievedAt: '2026-09-08T12:00:00.000Z',
        },
      }),
    });
    assert.equal(result.kind, 'found');
    if (result.kind === 'found') {
      assert.equal(result.product.source, 'opf');
      assert.equal(result.product.sourceDatabase, 'opf');
      assert.equal(result.product.domain, 'unknown');
      assert.equal(result.product.beauty, undefined);
    }
  });

  it('honors explicit user domain override without changing source provenance', async () => {
    const result = await resolveScan({
      candidate,
      catalog: [],
      domainOverride: 'household',
      lookupRemote: async () => ({
        kind: 'found',
        product: { name: 'Ambiguous cleaner', source: 'opf', domain: 'unknown' },
      }),
    });
    assert.equal(result.kind, 'found');
    if (result.kind === 'found') {
      assert.equal(result.product.domain, 'household');
      assert.equal(result.product.domainSource, 'user');
      assert.equal(result.product.source, 'opf');
    }

    const explicitUnknown = await resolveScan({
      candidate,
      catalog: [],
      domainOverride: 'unknown',
      lookupRemote: async () => ({
        kind: 'found',
        product: { name: 'Face cream', category: 'Cosmetics', source: 'opf', domain: 'cosmetic' },
      }),
    });
    assert.equal(explicitUnknown.kind, 'found');
    if (explicitUnknown.kind === 'found') {
      assert.equal(explicitUnknown.product.domain, 'unknown');
      assert.equal(explicitUnknown.product.domainSource, 'user');
    }
  });

  it('short-circuits explicit issuer-bound restricted-circulation codes and requires confirmation', async () => {
    let remoteCalled = false;
    const result = await resolveScan({
      candidate: { rawValue: '2003200020807', format: 'EAN_13', source: 'wedge' },
      catalog: [],
      restrictedCirculation: {
        enabled: true,
        issuer: 'Test grocer',
        prefix: '2',
        itemStart: 1,
        itemLength: 6,
        amountStart: 7,
        amountLength: 5,
        amountDecimals: 2,
        currency: 'MAD',
      },
      lookupRemote: async () => { remoteCalled = true; return { kind: 'not-found' }; },
    });
    assert.equal(result.kind, 'restricted-circulation');
    if (result.kind === 'restricted-circulation') {
      assert.equal(result.amount, 20.8);
      assert.equal(result.issuer, 'Test grocer');
      assert.equal(result.requiresConfirmation, true);
    }
    assert.equal(remoteCalled, false);
  });

  it('propagates caller cancellation and classifies timeout/network failures without false not-found claims', async () => {
    const controller = new AbortController();
    controller.abort();
    const aborted = await resolveScan({ candidate, catalog: [], signal: controller.signal });
    assert.equal(aborted.kind, 'not-found');
    if (aborted.kind === 'not-found') assert.equal(aborted.reason, 'aborted');

    const failed = await resolveScan({
      candidate,
      catalog: [],
      timeoutMs: 50,
      lookupRemote: async () => { throw new Error('network'); },
    });
    assert.equal(failed.kind, 'not-found');
    if (failed.kind === 'not-found') assert.equal(failed.reason, 'lookup-failed');
  });
});
