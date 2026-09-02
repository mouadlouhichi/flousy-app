import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryRateLimiter } from '../src/index';

test('allows up to max hits inside the window', () => {
  const limiter = createMemoryRateLimiter({ windowMs: 1000, max: 2 });
  assert.equal(limiter.limited('a', 0), false);
  assert.equal(limiter.limited('a', 1), false);
  assert.equal(limiter.limited('a', 2), true);
});

test('resets after the window', () => {
  const limiter = createMemoryRateLimiter({ windowMs: 10, max: 1 });
  assert.equal(limiter.limited('a', 0), false);
  assert.equal(limiter.limited('a', 1), true);
  assert.equal(limiter.limited('a', 11), false);
});

test('tracks keys independently', () => {
  const limiter = createMemoryRateLimiter({ windowMs: 1000, max: 1 });
  assert.equal(limiter.limited('a', 0), false);
  assert.equal(limiter.limited('b', 0), false);
  assert.equal(limiter.limited('a', 1), true);
});
