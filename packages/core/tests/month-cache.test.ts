import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_MONTH_STORAGE_KEY,
  isMonthKey,
  readCachedMonth,
  readStoredMonthKey,
  writeCachedMonth,
  writeStoredMonthKey,
} from '../src/month-cache';

function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    data,
  };
}

describe('month cache', () => {
  it('accepts YYYY-MM keys only', () => {
    assert.equal(isMonthKey('2026-08'), true);
    assert.equal(isMonthKey('2026-8'), false);
    assert.equal(isMonthKey('current'), false);
    assert.equal(isMonthKey(null), false);
  });

  it('persists the viewed month key and ignores junk', () => {
    const storage = memoryStorage();
    writeStoredMonthKey('2026-07', storage);
    assert.equal(storage.data[CURRENT_MONTH_STORAGE_KEY], '2026-07');
    assert.equal(readStoredMonthKey(storage), '2026-07');

    writeStoredMonthKey('not-a-month', storage);
    assert.equal(readStoredMonthKey(storage), '2026-07');

    const junk = memoryStorage({ [CURRENT_MONTH_STORAGE_KEY]: 'nope' });
    assert.equal(readStoredMonthKey(junk), null);
  });

  it('round-trips a cached month document so navigation can hydrate without a network wait', () => {
    const storage = memoryStorage();
    const storageKey = 'flousy_month_2026-08';
    writeCachedMonth(storageKey, { totalBudget: 12500 } as any, storage);

    const cached = readCachedMonth(storageKey, '2026-08', undefined, storage);
    assert.ok(cached);
    assert.equal(cached.totalBudget, 12500);
    assert.equal(readCachedMonth('flousy_month_missing', '2026-08', undefined, storage), null);
  });

  it('returns null for corrupt cached JSON', () => {
    const storage = memoryStorage({ 'flousy_month_2026-08': '{not-json' });
    assert.equal(readCachedMonth('flousy_month_2026-08', '2026-08', undefined, storage), null);
  });
});
