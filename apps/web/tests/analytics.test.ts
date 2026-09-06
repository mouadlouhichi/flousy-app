import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAnalyticsParams } from '../src/lib/analytics';

test('analytics parameter sanitizer strips financial and free-text fields', () => {
  assert.deepEqual(sanitizeAnalyticsParams({
    workspace: 'personal',
    amount: 1250,
    total_budget: 5000,
    category: 'Medical',
    merchant_name: 'Private clinic',
    note: 'sensitive free text',
    has_query: false,
    duration_days: 90,
    malformed_key_that_is_far_too_long_for_the_analytics_contract: 'ignored',
    nested: { secret: true },
  }), {
    workspace: 'personal',
    has_query: false,
    duration_days: 90,
  });
});

test('analytics parameter sanitizer bounds strings and non-finite numbers', () => {
  assert.equal(sanitizeAnalyticsParams({ message: 'x'.repeat(200), count: Infinity }), undefined);
  assert.deepEqual(sanitizeAnalyticsParams({ method: 'email', duration_days: 90 }), { method: 'email', duration_days: 90 });
});
