import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmountInput } from '../src/lib/parse-amount';

describe('parseAmountInput — audit P1: locale-aware amount parsing', () => {
  it('parses plain ASCII amounts like before', () => {
    assert.equal(parseAmountInput('15000'), 15000);
    assert.equal(parseAmountInput('1234.56'), 1234.56);
    assert.equal(parseAmountInput('0.75'), 0.75);
    assert.equal(parseAmountInput('  42 '), 42);
  });

  it('parses French decimal commas instead of stripping them', () => {
    assert.equal(parseAmountInput('1234,56'), 1234.56);
    assert.equal(parseAmountInput('0,75'), 0.75);
    assert.equal(parseAmountInput('1 234,56'), 1234.56);
    // Narrow no-break space — what Intl.NumberFormat('fr') actually emits.
    assert.equal(parseAmountInput('1\u202f234,56'), 1234.56);
  });

  it('parses Arabic-Indic digits instead of dropping them', () => {
    assert.equal(parseAmountInput('١٥٠٠٠'), 15000);
    assert.equal(parseAmountInput('١٢٣٤٫٥٦'), 1234.56); // ٫ = Arabic decimal sep
    assert.equal(parseAmountInput('١٬٢٣٤'), 1234); // ٬ = Arabic thousands sep
    assert.equal(parseAmountInput('۱۲۳'), 123); // Extended (Persian) digits
  });

  it('resolves mixed separators by position', () => {
    assert.equal(parseAmountInput('1.234,56'), 1234.56);
    assert.equal(parseAmountInput('1,234.56'), 1234.56);
    assert.equal(parseAmountInput('12,345,678'), 12345678);
    assert.equal(parseAmountInput('1.234.567'), 1234567);
  });

  it('ignores currency symbols and letters', () => {
    assert.equal(parseAmountInput('MAD 1500'), 1500);
    assert.equal(parseAmountInput('1 500 د.م.'), 1500);
    assert.equal(parseAmountInput('$1,234.56'), 1234.56);
  });

  it('keeps single-dot decimals as decimals (previous behaviour)', () => {
    assert.equal(parseAmountInput('1.234'), 1.234);
    assert.equal(parseAmountInput('1500.5'), 1500.5);
  });

  it('returns NaN for junk instead of coercing to 0', () => {
    assert.ok(Number.isNaN(parseAmountInput('')));
    assert.ok(Number.isNaN(parseAmountInput('abc')));
    assert.ok(Number.isNaN(parseAmountInput(null)));
    assert.ok(Number.isNaN(parseAmountInput(undefined)));
  });

  it('rejects scientific notation rather than mangling it into a real number', () => {
    // Stripping the letter turned "1e5" into "15" — a plausible wrong amount,
    // which is worse than a visible rejection.
    assert.ok(Number.isNaN(parseAmountInput('1e5')));
    assert.ok(Number.isNaN(parseAmountInput('2.5E3')));
    assert.ok(Number.isNaN(parseAmountInput('1e-3')));
    // Currency letters around a plain number are still fine.
    assert.equal(parseAmountInput('1500 MAD'), 1500);
    assert.equal(parseAmountInput('DH 250'), 250);
  });
});
