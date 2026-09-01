import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type CatalogValue = string | number | boolean | CatalogValue[] | { [key: string]: CatalogValue };

function readCatalog(locale: string): CatalogValue {
  return JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')) as CatalogValue;
}

function catalogShape(value: CatalogValue): unknown {
  if (Array.isArray(value)) return value.map(catalogShape);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, catalogShape(nested)]),
    );
  }
  return typeof value;
}

describe('message catalog parity', () => {
  it('keeps French and Arabic keys and value shapes aligned with English', () => {
    const englishShape = catalogShape(readCatalog('en'));
    assert.deepEqual(catalogShape(readCatalog('fr')), englishShape);
    assert.deepEqual(catalogShape(readCatalog('ar')), englishShape);
  });
});
