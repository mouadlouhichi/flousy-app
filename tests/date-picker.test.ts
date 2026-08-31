import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dateFromInputValue, dateToInputValue } from '../src/components/ui/date-picker';

describe('custom expense date picker values', () => {
  it('parses an ISO calendar date in local calendar time without UTC drift', () => {
    const parsed = dateFromInputValue('2026-08-30');

    assert.ok(parsed);
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 7);
    assert.equal(parsed.getDate(), 30);
    assert.equal(dateToInputValue(parsed), '2026-08-30');
  });

  it('does not silently roll invalid dates into another month', () => {
    assert.equal(dateFromInputValue('2026-02-29'), undefined);
    assert.equal(dateFromInputValue('2026-02-31'), undefined);
    assert.equal(dateFromInputValue('30/08/2026'), undefined);
  });
});
