import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrencyParts, isLetterCurrencySymbol } from '../src/lib/currency';

describe('isLetterCurrencySymbol', () => {
  it('treats ISO letter codes as compact and single-character symbols as large', () => {
    assert.equal(isLetterCurrencySymbol('MAD'), true);
    assert.equal(isLetterCurrencySymbol('AED'), true);
    assert.equal(isLetterCurrencySymbol('CHF'), true);
    assert.equal(isLetterCurrencySymbol('CA$'), true);
    assert.equal(isLetterCurrencySymbol('CFA'), true);
    assert.equal(isLetterCurrencySymbol('€'), false);
    assert.equal(isLetterCurrencySymbol('$'), false);
    assert.equal(isLetterCurrencySymbol('£'), false);
  });
});

describe('formatCurrencyParts', () => {
  it('splits a MAD amount so the code can render smaller than the number', () => {
    const parts = formatCurrencyParts(1234.5, 'MAD', 'en-US');
    assert.match(parts.amount, /1[,.]?234/);
    assert.equal(parts.currency.includes('MAD') || parts.currency === 'MAD', true);
  });
});
