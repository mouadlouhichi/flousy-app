import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRO_PRICING, formatCents, getNextBillingDate } from '../src/index';

test('pro pricing is in dollars not cents', () => {
  assert.equal(PRO_PRICING.monthly, 4.99);
  assert.equal(PRO_PRICING.annual, 39.99);
});

test('formatCents formats USD', () => {
  assert.equal(formatCents(499, 'USD'), '$4.99');
});

test('getNextBillingDate returns an ISO date', () => {
  assert.match(getNextBillingDate('monthly'), /^\d{4}-\d{2}-\d{2}$/);
});
