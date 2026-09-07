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

  it('maps the raw Open Food Facts v2 shape ({ status: 1, product })', () => {
    assert.deepEqual(mapOffProduct({ status: 1, product }), {
      name: 'Sidi Ali',
      brand: 'Sidi Ali',
      category: 'Natural mineral waters',
      imageUrl: 'https://example.com/sidi.jpg',
      quantity: '2 L',
    });
  });

  it('maps the app-proxy shape ({ found: true, product }) — the historical bug', () => {
    assert.deepEqual(mapOffProduct({ found: true, product }), {
      name: 'Sidi Ali',
      brand: 'Sidi Ali',
      category: 'Natural mineral waters',
      imageUrl: 'https://example.com/sidi.jpg',
      quantity: '2 L',
    });
  });

  it('maps the Nutri-Score ranking when the source provides a real grade', () => {
    const withScore = mapOffProduct({
      status: 1,
      product: { ...product, nutriscore_grade: 'c', nutriscore_score: 45 },
    });
    assert.deepEqual(withScore?.ranking, { grade: 'c', score: 45 });

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

describe('lookupOffProduct outcome contract', () => {
  const realFetch = globalThis.fetch;
  const proxyUrl = '/api/barcode/lookup';

  function mockFetch(script: Array<(url: string) => Response | null>) {
    let i = 0;
    globalThis.fetch = ((url: string | URL | Request) => {
      const u = String(url);
      const make = script[Math.min(i, script.length - 1)];
      i += 1;
      return Promise.resolve(make(u));
    }) as typeof fetch;
  }

  function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  after(() => {
    globalThis.fetch = realFetch;
  });

  it('found directly from the world API without touching the proxy', async () => {
    const seen: string[] = [];
    mockFetch([(u) => {
      seen.push(u);
      return json(200, { status: 1, product: { product_name: 'Sidi Ali', brands: 'Sidi Ali' } });
    }]);
    const out = await lookupOffProduct('6111035002175', { proxyUrl });
    assert.deepEqual(out, { kind: 'found', product: { name: 'Sidi Ali', brand: 'Sidi Ali' } });
    assert.equal(seen.length, 1, 'must not fall through to the proxy on a direct hit');
    assert.ok(seen[0].startsWith('https://world.openfoodfacts.org/'), seen[0]);
  });

  it('direct status:0 falls through; the proxy hit wins', async () => {
    mockFetch([
      () => json(200, { status: 0, status_verbose: 'product found with a different product type: beauty' }),
      (u) => {
        assert.ok(u.startsWith(proxyUrl), u);
        return json(200, {
          status: 1,
          found: true,
          product: { product_name: '68YN5T 400ml', brands: 'Ultra doux', nutriscore_grade: 'not-applicable' },
        });
      },
    ]);
    const out = await lookupOffProduct('3600541177741', { proxyUrl });
    // non-grade nutriscore must not surface as a ranking
    assert.deepEqual(out, { kind: 'found', product: { name: '68YN5T 400ml', brand: 'Ultra doux' } });
  });

  it('a definitive proxy answer "no such product" is not-found', async () => {
    mockFetch([
      () => json(200, { status: 0 }),
      (u) => {
        assert.ok(u.startsWith(proxyUrl), u);
        return json(200, { status: 0, found: false, product: null });
      },
    ]);
    const out = await lookupOffProduct('0000000000000', { proxyUrl });
    assert.deepEqual(out, { kind: 'not-found' });
  });

  it('a dead network on both paths is an ERROR, not a false not-found', async () => {
    // direct attempt throws; proxy attempt throws → the caller must be able
    // to offer a retry instead of claiming the product does not exist
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    const out = await lookupOffProduct('6111035002175', { proxyUrl });
    assert.deepEqual(out, { kind: 'error' });
  });

  it('a proxy 502 (upstream walk failed) is an ERROR, not not-found', async () => {
    mockFetch([
      () => json(200, { status: 0 }),
      (u) => {
        assert.ok(u.startsWith(proxyUrl), u);
        return json(502, { status: 0, found: false, product: null, error: 'lookup failed' });
      },
    ]);
    const out = await lookupOffProduct('6111035002175', { proxyUrl });
    assert.deepEqual(out, { kind: 'error' });
  });

  it('a proxy rate-limit (429) is an ERROR, not not-found', async () => {
    mockFetch([
      () => json(200, { status: 0 }),
      (u) => {
        assert.ok(u.startsWith(proxyUrl), u);
        return json(429, { status: 0, found: false, product: null, error: 'too many lookups' });
      },
    ]);
    const out = await lookupOffProduct('6111035002175', { proxyUrl });
    assert.deepEqual(out, { kind: 'error' });
  });
});
