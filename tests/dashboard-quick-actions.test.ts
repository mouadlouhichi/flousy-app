import test from 'node:test';
import assert from 'node:assert/strict';
import ar from '../messages/ar.json';
import type { Messages } from '../src/lib/i18n-core';
import { getMobileQuickActions } from '../src/lib/dashboard-quick-actions';

test('dashboard quick actions expose the expected mobile menu items', () => {
  const actions = getMobileQuickActions();

  assert.deepEqual(actions.map((action) => action.label), [
    'Add Expense',
    'Add Fixed Charge',
    'Create Saving Goal',
    'Start course',
  ]);
});

test('dashboard quick actions use the supplied Arabic catalog', () => {
  const actions = getMobileQuickActions(ar as Messages);

  assert.deepEqual(actions.map((action) => action.label), [
    'إضافة مصروف',
    'إضافة رسوم ثابتة',
    'إنشاء هدف ادخار',
    'بدء التسوق',
  ]);
});
