import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapOffProduct } from '../src/lib/product-lookup';
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
