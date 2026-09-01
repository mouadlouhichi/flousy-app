import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentMonthKey, getSourcePeriod } from '../src/lib/utils';

describe('custom monthly start dates', () => {
  it('keeps the previous budget period active before payday', () => {
    assert.equal(getCurrentMonthKey(27, new Date(2026, 8, 1)), '2026-08');
    assert.equal(getCurrentMonthKey(27, new Date(2026, 8, 26)), '2026-08');
    assert.equal(getCurrentMonthKey(27, new Date(2026, 8, 27)), '2026-09');
  });

  it('describes a payday period through the day before the next payday', () => {
    assert.deepEqual(getSourcePeriod('2026-08', 27), {
      periodKey: '2026-08',
      startDate: '2026-08-27',
      endDate: '2026-09-26',
    });
  });
});
