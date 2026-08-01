import test from 'node:test';
import assert from 'node:assert/strict';
import { getMobileQuickActions } from '../src/dashboard-quick-actions';

test('dashboard quick actions expose the expected mobile menu items', () => {
  const actions = getMobileQuickActions();

  assert.deepEqual(actions.map((action) => action.label), [
    'Add Expense',
    'Add Charge',
    'New Savings Goal',
  ]);
});
