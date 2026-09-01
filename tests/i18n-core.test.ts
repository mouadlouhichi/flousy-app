import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatLocalizedPercent, formatMessage, getLocalizedPercentSign } from '../src/lib/i18n-core';

describe('localized percentage formatting', () => {
  it('uses each locale’s own spacing and bidirectional formatting', () => {
    assert.equal(formatLocalizedPercent(50, 'en-US'), '50%');
    assert.equal(formatLocalizedPercent(50, 'fr-FR'), '50 %');

    const arabic = formatLocalizedPercent(50, 'ar-MA');
    assert.ok(arabic.includes(new Intl.NumberFormat('ar-MA').format(50)));
    assert.ok(arabic.includes(getLocalizedPercentSign('ar-MA')));
  });

  it('extracts a usable locale-specific percent sign for input adornments', () => {
    for (const locale of ['en-US', 'fr-FR', 'ar-MA']) {
      assert.notEqual(getLocalizedPercentSign(locale), '');
    }
  });

  it('formats the number represented by an ICU plural marker with the active locale', () => {
    const template = '{count, plural, one {# entry} other {# entries}}';
    const count = 1234;
    assert.equal(
      formatMessage(template, { count }, 'ar-MA'),
      `${new Intl.NumberFormat('ar-MA').format(count)} entries`,
    );
  });
});
