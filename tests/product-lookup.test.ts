import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookupOffProduct, mapOffProduct } from '../src/lib/product-lookup';
import { barcodeChecksumValid } from '../src/lib/course-session';
import { lookupMaSeed, MA_SEED_COUNT } from '../src/lib/ma-product-seed';

describe('mapOffProduct', () => {
  const product = {
    code: '6111035002175',
    product_name: 'Sidi Ali',
    product_name_fr: 'Sidi Ali',
    brands: 'Sidi Ali',
    categories: 'Natural mineral waters',
    image_front_url: 'https://example.com/sidi.jpg',
    quantity: '2 L',
  };

  it('maps raw and same-origin proxy shapes with complete source metadata', () => {
    for (const root of [{ status: 1, product }, { found: true, product }]) {
      const mapped = mapOffProduct(root, { retrievedAt: '2026-09-08T12:00:00.000Z' });
      assert.ok(mapped);
      assert.deepEqual({
        name: mapped.name,
        brand: mapped.brand,
        category: mapped.category,
        imageUrl: mapped.imageUrl,
        quantity: mapped.quantity,
        domain: mapped.domain,
        source: mapped.source,
        sourceDatabase: mapped.sourceDatabase,
        retrievedAt: mapped.retrievedAt,
      }, {
        name: 'Sidi Ali',
        brand: 'Sidi Ali',
        category: 'Natural mineral waters',
        imageUrl: 'https://example.com/sidi.jpg',
        quantity: '2 L',
        domain: 'food',
        source: 'off',
        sourceDatabase: 'off',
        retrievedAt: '2026-09-08T12:00:00.000Z',
      });
      assert.equal(mapped.provenance?.name?.source, 'off');
      assert.equal(mapped.provenance?.name?.retrievedAt, '2026-09-08T12:00:00.000Z');
    }
  });

  it('maps the Nutri-Score ranking when the source provides a real grade', () => {
    const withScore = mapOffProduct({
      status: 1,
      product: { ...product, nutriscore_grade: 'c', nutriscore_score: 45 },
    });
    assert.deepEqual(withScore?.ranking, { grade: 'c', calculationPoints: 45 });

    const gradeOnly = mapOffProduct({
      status: 1,
      product: { ...product, nutriscore_grade: 'A' },
    });
    assert.deepEqual(gradeOnly?.ranking, { grade: 'a' }); // normalised to lower-case
  });

  it('never surfaces a non-grade Nutri-Score value as a ranking', () => {
    for (const junk of ['not-applicable', 'unknown', 'not-computed', 'en-d', '', null, 'f']) {
      assert.equal(
        mapOffProduct({ status: 1, product: { ...product, nutriscore_grade: junk } })?.ranking,
        undefined,
        `nutriscore_grade=${String(junk)} must not produce a ranking`,
      );
    }
  });

  it('falls back to the French / English / generic name fields', () => {
    assert.equal(
      mapOffProduct({ status: 1, product: { product_name_fr: 'Eau minérale' } })?.name,
      'Eau minérale',
    );
    assert.equal(
      mapOffProduct({ found: true, product: { product_name_en: 'Mineral water' } })?.name,
      'Mineral water',
    );
  });

  it('prefers the UI-language name over the default product_name', () => {
    // The 3600541177741 case: product_name is a code-like label while the
    // French name is the real one.
    const showerGel = {
      product_name: '68YN5T 400ml',
      product_name_fr: 'utra doux avocat',
      product_name_en: '68YN5T 400ml',
    };
    assert.equal(mapOffProduct({ status: 1, product: showerGel }, { lang: 'fr' })?.name, 'utra doux avocat');
    assert.equal(mapOffProduct({ status: 1, product: showerGel }, { lang: 'ar' })?.name, '68YN5T 400ml'); // no ar name → default
    assert.equal(mapOffProduct({ status: 1, product: showerGel }, { lang: 'en' })?.name, '68YN5T 400ml'); // en name = default
    // Without a lang, the historical default order applies.
    assert.equal(mapOffProduct({ status: 1, product: showerGel })?.name, '68YN5T 400ml');
  });

  it('hides placeholder categories ("Incorrect product type" and friends)', () => {
    // The 3600541177741 case: every category is a placeholder tag.
    const showerGel = {
      product_name: '68YN5T 400ml',
      categories: 'Incorrect product type, non-food-products, open-beauty-facts',
    };
    assert.equal(mapOffProduct({ status: 1, product: showerGel })?.category, undefined);
    // A real category after the placeholders is the one that shows.
    const mixed = {
      product_name: 'X',
      categories: 'Incorrect product type, beverages, soft drinks',
    };
    assert.equal(mapOffProduct({ status: 1, product: mixed })?.category, 'beverages');
    // Normal lists are untouched.
    assert.equal(
      mapOffProduct({ status: 1, product: { product_name: 'X', categories: 'Natural mineral waters' } })?.category,
      'Natural mineral waters',
    );
  });

  it('hides placeholder categories ("Incorrect product type" and friends)', () => {
    // The 3600541177741 case: every category is a placeholder tag.
    const showerGel = {
      product_name: '68YN5T 400ml',
      categories: 'Incorrect product type, non-food-products, open-beauty-facts',
    };
    assert.equal(mapOffProduct({ status: 1, product: showerGel })?.category, undefined);
    // A real category after the placeholders is the one that shows.
    const mixed = {
      product_name: 'X',
      categories: 'Incorrect product type, beverages, soft drinks',
    };
    assert.equal(mapOffProduct({ status: 1, product: mixed })?.category, 'beverages');
    // Normal lists are untouched.
    assert.equal(
      mapOffProduct({ status: 1, product: { product_name: 'X', categories: 'Natural mineral waters' } })?.category,
      'Natural mineral waters',
    );
  });

  it('does not treat source placeholder tags as proof of a cosmetic domain', () => {
    const showerGel = {
      product_name: '68YN5T 400ml',
      categories: 'Incorrect product type, non-food-products, open-beauty-facts',
    };
    const mapped = mapOffProduct({ status: 1, product: showerGel });
    assert.equal(mapped?.category, undefined);
    assert.equal(mapped?.beauty, undefined);
    assert.equal(mapped?.domain, 'food', 'raw mapOffProduct payloads default to the food database');
    const obf = mapOffProduct({ status: 1, product: showerGel }, { database: 'obf' });
    assert.equal(obf?.domain, 'cosmetic');
  });

  it('marks cosmetics from categories_tags / product_type (not just the display string)', () => {
    const fromTags = mapOffProduct({
      status: 1,
      product: {
        product_name: '68YN5T 400ml',
        categories: 'Incorrect product type, non-food-products',
        categories_tags: ['incorrect-product-type', 'non-food-products', 'open-beauty-facts'],
      },
    });
    assert.equal(fromTags?.beauty, undefined, 'database-family tags are provenance, not domain proof');

    const fromType = mapOffProduct({
      status: 1,
      product: { product_name: 'Autre doux', product_type: 'beauty' },
    });
    assert.equal(fromType?.beauty, true);
  });

  it('carries the proxy beauty_hint through the mapper', () => {
    const mapped = mapOffProduct({ found: true, product: { product_name: 'Crème', beauty_hint: true } });
    assert.equal(mapped?.beauty, true);
  });

  it('skips empty UI-language names in the priority chain', () => {
    const product = {
      product_name_ar: '',
      product_name: 'Eau',
      product_name_fr: 'Eau minérale',
    };
    assert.equal(mapOffProduct({ status: 1, product }, { lang: 'ar' })?.name, 'Eau');
    assert.equal(mapOffProduct({ status: 1, product }, { lang: 'fr' })?.name, 'Eau minérale');
  });
});

describe('Moroccan seed catalog', () => {
  it('is non-empty and resolves the Sidi Ali barcode from the report', () => {
    assert.ok(MA_SEED_COUNT > 0);
    assert.deepEqual(lookupMaSeed('6111035002175'), {
      name: 'Sidi Ali',
      brand: 'Sidi Ali',
      category: 'Eaux',
    });
  });

  it('returns null for unknown barcodes', () => {
    assert.equal(lookupMaSeed('0000000000000'), null);
    assert.equal(lookupMaSeed(''), null);
  });

  it('resolves Magix / Maxi\'s Mutandis detergents (and ITF-14 cartons)', () => {
    assert.deepEqual(lookupMaSeed('6111242926974'), {
      name: 'Magix Pâte',
      brand: 'Magix',
      category: 'Entretien',
    });
    assert.equal(lookupMaSeed('6111242925540')?.name, 'Magix Lessive liquide Fraîcheur Printemps 500 ml');
    assert.equal(lookupMaSeed('16111242925540')?.brand, 'Magix');
    assert.equal(lookupMaSeed('6111242922129')?.brand, "Maxi's");
  });

  it('every seed barcode has a valid EAN-8 / EAN-13 checksum (typo guard)', () => {
    // The seed map is a private constant, so we enumerate its keys by reading
    // the source file (same technique as the message-catalog parity test).
    const source = readFileSync(new URL('../src/lib/ma-product-seed.ts', import.meta.url), 'utf8');
    const codes = [...source.matchAll(/'(\d{8}|\d{13})':/g)].map((m) => m[1]);
    assert.ok(codes.length >= MA_SEED_COUNT, 'expected to enumerate the seed barcodes');
    for (const code of codes) {
      assert.ok(barcodeChecksumValid(code), `seed barcode ${code} fails its EAN checksum`);
    }
  });
});

describe('lookupOffProduct same-origin outcome contract', () => {
  const realFetch = globalThis.fetch;
  const proxyUrl = '/api/barcode/lookup';

  function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  after(() => {
    globalThis.fetch = realFetch;
  });

  it('makes one same-origin request and retains server source provenance', async () => {
    const seen: string[] = [];
    globalThis.fetch = (async (input) => {
      seen.push(String(input));
      return json(200, {
        status: 1,
        found: true,
        lookupSource: 'off',
        sourceUrl: 'https://world.openfoodfacts.org/product/6111035002175',
        retrievedAt: '2026-09-08T12:00:00.000Z',
        product: { product_name: 'Sidi Ali', brands: 'Sidi Ali' },
      });
    }) as typeof fetch;

    const out = await lookupOffProduct('6111035002175', { proxyUrl, lang: 'fr' });
    assert.equal(out.kind, 'found');
    if (out.kind === 'found') {
      assert.equal(out.product.name, 'Sidi Ali');
      assert.equal(out.product.domain, 'food');
      assert.equal(out.product.sourceDatabase, 'off');
      assert.equal(out.product.sourceUrl, 'https://world.openfoodfacts.org/product/6111035002175');
      assert.equal(out.product.retrievedAt, '2026-09-08T12:00:00.000Z');
    }
    assert.equal(seen.length, 1);
    assert.equal(seen[0], `${proxyUrl}?code=6111035002175&lang=fr`);
  });

  it('maps a found response while refusing non-grade Nutri-Score values', async () => {
    globalThis.fetch = (async () => json(200, {
      status: 1,
      found: true,
      lookupSource: 'obf',
      product: {
        product_name: '68YN5T 400ml',
        brands: 'Ultra doux',
        nutriscore_grade: 'not-applicable',
      },
    })) as typeof fetch;
    const out = await lookupOffProduct('3600541177741', { proxyUrl });
    assert.equal(out.kind, 'found');
    if (out.kind === 'found') {
      assert.equal(out.product.name, '68YN5T 400ml');
      assert.equal(out.product.ranking, undefined);
      assert.equal(out.product.domain, 'cosmetic');
    }
  });

  it('returns not-found only for a definitive successful miss', async () => {
    globalThis.fetch = (async () => json(200, { status: 0, found: false, product: null })) as typeof fetch;
    assert.deepEqual(await lookupOffProduct('0000000000000', { proxyUrl }), { kind: 'not-found' });
  });

  it('classifies network/abort, invalid JSON, and upstream HTTP failures', async () => {
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    assert.deepEqual(await lookupOffProduct('6111035002175', { proxyUrl }), {
      kind: 'error', reason: 'timeout',
    });

    globalThis.fetch = (async () => new Response('not-json', { status: 200 })) as typeof fetch;
    assert.deepEqual(await lookupOffProduct('6111035002175', { proxyUrl }), {
      kind: 'error', reason: 'invalid-response',
    });

    for (const status of [429, 502]) {
      globalThis.fetch = (async () => json(status, { status: 0, found: false, error: 'upstream' })) as typeof fetch;
      assert.deepEqual(await lookupOffProduct('6111035002175', { proxyUrl }), {
        kind: 'error', reason: 'upstream',
      });
    }

    const controller = new AbortController();
    controller.abort();
    assert.deepEqual(await lookupOffProduct('6111035002175', { proxyUrl, signal: controller.signal }), {
      kind: 'error', reason: 'aborted',
    });
  });
});
