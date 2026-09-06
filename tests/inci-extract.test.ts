import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractInciList } from '../src/lib/inci-extract';
import { classifyInci } from '../src/lib/inci-quality';

describe('extractInciList', () => {
  it('extracts the INCI section after the INGREDIENTS marker and stops at MADE IN', () => {
    const ocr = [
      'GARNIER ULTRA DOUX SHAMPOO',
      '400 ml',
      'INGREDIENTS: AQUA/WATER, SODIUM LAURYL SULFATE, PARFUM,',
      'GLYCERIN, PHENOXYETHANOL',
      'MADE IN FRANCE',
      'LOT 12345',
    ].join('\n');
    assert.deepEqual(extractInciList(ocr), [
      'AQUA/WATER',
      'SODIUM LAURYL SULFATE',
      'PARFUM',
      'GLYCERIN',
      'PHENOXYETHANOL',
    ]);
  });

  it('supports French and Arabic section headers', () => {
    assert.deepEqual(extractInciList('INGRÉDIENTS : AQUA, PARFUM\nEXP 2027'), ['AQUA', 'PARFUM']);
    assert.deepEqual(extractInciList('المكونات: AQUA, GLYCERIN\nصنع في المغرب'), ['AQUA', 'GLYCERIN']);
  });

  it('splits on line wraps and deduplicates case-insensitively', () => {
    const ocr = 'INCI\nAQUA\nSODIUM LAURYL\nSULFATE\naqua\nPARFUM';
    assert.deepEqual(extractInciList(ocr), ['AQUA', 'SODIUM LAURYL', 'SULFATE', 'PARFUM']);
  });

  it('strips percentage qualifiers and skips pure numbers/symbols', () => {
    const ocr = 'INGREDIENTS: SODIUM LAURYL SULFATE (5%), AQUA, 400ml, (12.5%)';
    assert.deepEqual(extractInciList(ocr), ['SODIUM LAURYL SULFATE', 'AQUA']);
  });

  it('returns [] when no INCI section header is present', () => {
    assert.deepEqual(extractInciList('JUST A PRODUCT NAME 400 ml'), []);
    assert.deepEqual(extractInciList(''), []);
  });

  it('cuts the list at barcodes and lot numbers', () => {
    assert.deepEqual(extractInciList('INCI AQUA\nPARFUM\n3017624479001'), ['AQUA', 'PARFUM']);
  });
});

describe('classifyInci with OCR-style spellings', () => {
  it('matches names across slash/hyphen OCR variants', () => {
    // "AQUA WATER" is OCR for AQUA/WATER → still the water common name.
    assert.equal(classifyInci(['AQUA WATER']).ingredients[0]?.common, 'water');
    // "SODIUM-LAURYL-SULFATE" is OCR for SODIUM LAURYL SULFATE → still concern.
    assert.equal(classifyInci(['SODIUM-LAURYL-SULFATE']).ingredients[0]?.tier, 'concern');
    // "PEG 40 HYDROGENATED CASTOR OIL" without the hyphen.
    assert.deepEqual(classifyInci(['PEG 40 HYDROGENATED CASTOR OIL']).ingredients[0]?.tags, [
      'emulsifier',
      'solvent',
    ]);
  });

  it('keeps the original OCR spelling in the display row', () => {
    const result = classifyInci(['sodium-lauryl-sulfate']);
    assert.equal(result.ingredients[0]?.inci, 'sodium-lauryl-sulfate');
    assert.equal(result.ingredients[0]?.tier, 'concern');
  });
});
