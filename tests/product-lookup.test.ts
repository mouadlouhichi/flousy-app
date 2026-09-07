import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapOffProduct, mapInciProduct, lookupOffProduct } from '../src/lib/product-lookup';
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

  it('returns null when the product is missing or not found', () => {
    assert.equal(mapOffProduct(null), null);
    assert.equal(mapOffProduct({}), null);
    assert.equal(mapOffProduct({ status: 0, product: null }), null);
    assert.equal(mapOffProduct({ found: false, product: null }), null);
    assert.equal(mapOffProduct({ status: 1, product: {} }), null); // no name
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

describe('mapOffProduct — cosmetics (INCI) fields', () => {
  const cosmetic = {
    code: '3017624479001',
    product_name: 'La Roche-Posay Lipikar Baume AP+M',
    brands: 'La Roche-Posay',
    categories: 'Creams, Moisturizers',
    ingredients: 'AQUA, BUTYLPARABEN, DIMETHICONE, PARFUM, PROPYLENE GLYCOL',
  };

  it('maps the INCI ingredient string to a clean array with the beauty kind (direct lookup)', () => {
    assert.deepEqual(mapOffProduct({ status: 1, product: cosmetic }, 'beauty'), {
      name: 'La Roche-Posay Lipikar Baume AP+M',
      brand: 'La Roche-Posay',
      category: 'Creams',
      ingredients: ['AQUA', 'BUTYLPARABEN', 'DIMETHICONE', 'PARFUM', 'PROPYLENE GLYCOL'],
      productKind: 'beauty',
    });
  });

  it('reads the kind from the proxy payload source when no explicit kind is passed', () => {
    const mapped = mapOffProduct({ status: 1, found: true, source: 'beauty', product: cosmetic });
    assert.equal(mapped?.productKind, 'beauty');
    assert.deepEqual(mapped?.ingredients, ['AQUA', 'BUTYLPARABEN', 'DIMETHICONE', 'PARFUM', 'PROPYLENE GLYCOL']);
  });

  it('omits ingredients/productKind for products without them (backwards compatible shape)', () => {
    const mapped = mapOffProduct({ status: 1, product: { product_name: 'Plain food', source: undefined } }, 'food');
    assert.deepEqual(mapped, { name: 'Plain food', productKind: 'food' });
  });

  it('drops whitespace and blank ingredient entries', () => {
    const mapped = mapOffProduct(
      { status: 1, product: { product_name: 'X', ingredients: '  AQUA , , PARFUM , ' } },
      'beauty',
    );
    assert.deepEqual(mapped?.ingredients, ['AQUA', 'PARFUM']);
  });
});

describe('mapInciProduct', () => {
  it('maps the /api/inci/lookup proxy shape to a beauty product', () => {
    assert.deepEqual(
      mapInciProduct({
        found: true,
        product: {
          name: 'AHA Peeling Solution',
          brand: 'The Ordinary',
          category: 'Skincare',
          imageUrl: 'https://img.example/peel.jpg',
          ingredients: ['AQUA', 'LACTIC ACID', 'SALICYLIC ACID'],
        },
      }),
      {
        name: 'AHA Peeling Solution',
        brand: 'The Ordinary',
        category: 'Skincare',
        imageUrl: 'https://img.example/peel.jpg',
        ingredients: ['AQUA', 'LACTIC ACID', 'SALICYLIC ACID'],
        productKind: 'beauty',
      },
    );
  });

  it('returns null for misses and nameless payloads', () => {
    assert.equal(mapInciProduct(null), null);
    assert.equal(mapInciProduct({ found: false }), null);
    assert.equal(mapInciProduct({ found: true, product: { name: ' ' } }), null);
  });
});

describe('lookupOffProduct — INCI fallback', () => {
  type Handler = (url: string) => unknown;
  const OFF_MISS = { status: 0, product: null };
  const PROXY_MISS = { status: 0, found: false, product: null };

  function stubFetch(handler: Handler): { calls: string[]; restore: () => void } {
    const calls: string[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const body = handler(url);
      return new Response(JSON.stringify(body ?? null), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    return { calls, restore: () => { globalThis.fetch = real; } };
  }

  it('sends the call to INCI when every available dataset misses (not-found item)', async () => {
    const stub = stubFetch((url) => {
      if (url.includes('/api/inci/lookup')) {
        return {
          found: true,
          product: {
            name: 'AHA 30% + BHA 2% Peeling Solution',
            brand: 'The Ordinary',
            ingredients: ['AQUA', 'LACTIC ACID', 'SALICYLIC ACID', 'CITRIC ACID'],
          },
        };
      }
      return url.includes('/api/barcode/lookup') ? PROXY_MISS : OFF_MISS;
    });
    try {
      const result = await lookupOffProduct('0769915195606');
      assert.deepEqual(result, {
        name: 'AHA 30% + BHA 2% Peeling Solution',
        brand: 'The Ordinary',
        ingredients: ['AQUA', 'LACTIC ACID', 'SALICYLIC ACID', 'CITRIC ACID'],
        productKind: 'beauty',
      });
      // All datasets were searched, then exactly one INCI call.
      assert.ok(stub.calls.some((u) => u.includes('world.openfoodfacts.org')));
      assert.ok(stub.calls.some((u) => u.includes('world.openbeautyfacts.org')));
      assert.ok(stub.calls.some((u) => u.includes('/api/barcode/lookup')));
      assert.equal(stub.calls.filter((u) => u.includes('/api/inci/lookup')).length, 1);
    } finally {
      stub.restore();
    }
  });

  it('merges a beauty dataset hit without ingredients with the INCI list', async () => {
    const stub = stubFetch((url) => {
      if (url.includes('/api/inci/lookup')) {
        return { found: true, product: { name: 'Peeling Solution (INCI)', ingredients: ['AQUA', 'LACTIC ACID'] } };
      }
      if (url.includes('world.openbeautyfacts.org')) {
        return {
          status: 1,
          product: {
            product_name: 'Peeling Solution',
            brands: 'The Ordinary',
            image_front_url: 'https://img.example/peel.jpg',
          },
        };
      }
      return url.includes('/api/barcode/lookup') ? PROXY_MISS : OFF_MISS;
    });
    try {
      const result = await lookupOffProduct('0769915195606');
      assert.deepEqual(result, {
        name: 'Peeling Solution',
        brand: 'The Ordinary',
        imageUrl: 'https://img.example/peel.jpg',
        ingredients: ['AQUA', 'LACTIC ACID'],
        productKind: 'beauty',
      });
    } finally {
      stub.restore();
    }
  });

  it('never calls INCI for a food hit', async () => {
    const stub = stubFetch((url) => {
      if (url.includes('world.openfoodfacts.org')) {
        return { status: 1, product: { product_name: 'Cola 33cl', brands: 'Fizz' } };
      }
      return url.includes('/api/barcode/lookup') ? PROXY_MISS : OFF_MISS;
    });
    try {
      const result = await lookupOffProduct('1111111111111');
      assert.deepEqual(result, { name: 'Cola 33cl', brand: 'Fizz', productKind: 'food' });
      assert.ok(!stub.calls.some((u) => u.includes('/api/inci/lookup')), 'INCI must not be called for food');
    } finally {
      stub.restore();
    }
  });

  it('never calls INCI for a beauty hit that already carries its INCI list', async () => {
    const stub = stubFetch((url) => {
      if (url.includes('world.openbeautyfacts.org')) {
        return { status: 1, product: { product_name: 'Creme', brands: 'Co', ingredients: 'AQUA, GLYCERIN' } };
      }
      return url.includes('/api/barcode/lookup') ? PROXY_MISS : OFF_MISS;
    });
    try {
      const result = await lookupOffProduct('1111111111111');
      assert.deepEqual(result?.ingredients, ['AQUA', 'GLYCERIN']);
      assert.ok(!stub.calls.some((u) => u.includes('/api/inci/lookup')));
    } finally {
      stub.restore();
    }
  });

  it('keeps the dataset hit when INCI also misses', async () => {
    const stub = stubFetch((url) => {
      if (url.includes('world.openbeautyfacts.org')) {
        return { status: 1, product: { product_name: 'Creme', brands: 'Co' } };
      }
      return url.includes('/api/barcode/lookup') ? PROXY_MISS : OFF_MISS;
    });
    try {
      const result = await lookupOffProduct('1111111111111');
      assert.deepEqual(result, { name: 'Creme', brand: 'Co', productKind: 'beauty' });
    } finally {
      stub.restore();
    }
  });
});
