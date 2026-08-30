import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatShortDate } from '../src/utils';

describe('formatShortDate', () => {
  it('formats a YYYY-MM-DD date without a UTC offset shift', () => {
    assert.equal(formatShortDate('2026-08-29'), '29 Aug');
    assert.equal(formatShortDate('2026-01-05'), '5 Jan');
  });

  it('formats an ISO timestamp from the date portion', () => {
    assert.equal(formatShortDate('2026-08-29T23:00:00.000Z'), '29 Aug');
  });

  it('returns the original string when it is not a date', () => {
    assert.equal(formatShortDate('1st'), '1st');
    assert.equal(formatShortDate('Monthly'), 'Monthly');
  });
});
