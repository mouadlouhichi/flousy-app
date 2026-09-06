/**
 * Salary-period rollover detection (the "salary didn't reset on payday" bug).
 *
 * The dashboard used to honour the last-VIEWED month from storage on every
 * mount, so reopening the app after payday kept showing the old period.
 * `detectPeriodRollover` tracks the last-ACTIVE period per workspace context
 * and reports exactly once when a newer period has started, letting the
 * provider jump to the fresh budget and announce it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPeriodRollover, readActivePeriod, writeActivePeriod } from '../src/lib/month-cache';

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
  };
}

const CTX = 'personal:27';

test('first visit records the period silently (no rollover announcement)', () => {
  const storage = fakeStorage();
  assert.equal(detectPeriodRollover(CTX, '2026-09', storage), false);
  assert.equal(readActivePeriod(CTX, storage), '2026-09');
});

test('same period on later visits stays silent', () => {
  const storage = fakeStorage();
  detectPeriodRollover(CTX, '2026-09', storage);
  assert.equal(detectPeriodRollover(CTX, '2026-09', storage), false);
});

test('a newer period announces the rollover exactly once', () => {
  const storage = fakeStorage();
  detectPeriodRollover(CTX, '2026-08', storage);
  assert.equal(detectPeriodRollover(CTX, '2026-09', storage), true, 'payday passed while away');
  assert.equal(detectPeriodRollover(CTX, '2026-09', storage), false, 'no repeat on next mount');
});

test('year boundary compares chronologically (2025-12 -> 2026-01)', () => {
  const storage = fakeStorage();
  detectPeriodRollover(CTX, '2025-12', storage);
  assert.equal(detectPeriodRollover(CTX, '2026-01', storage), true);
});

test('an older resolved period never announces (clock skew safety)', () => {
  const storage = fakeStorage();
  detectPeriodRollover(CTX, '2026-09', storage);
  assert.equal(detectPeriodRollover(CTX, '2026-08', storage), false);
});

test('workspace contexts are tracked independently', () => {
  const storage = fakeStorage();
  detectPeriodRollover('personal:27', '2026-08', storage);
  detectPeriodRollover('household:1', '2026-09', storage);
  // Personal advances; the household context must not be affected.
  assert.equal(detectPeriodRollover('personal:27', '2026-09', storage), true);
  assert.equal(detectPeriodRollover('household:1', '2026-09', storage), false);
});

test('malformed keys are ignored', () => {
  const storage = fakeStorage();
  assert.equal(detectPeriodRollover(CTX, 'not-a-key', storage), false);
  assert.equal(readActivePeriod(CTX, storage), null);
  writeActivePeriod(CTX, 'nope', storage);
  assert.equal(readActivePeriod(CTX, storage), null);
});
