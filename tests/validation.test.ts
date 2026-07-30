import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  moneyAmountSchema,
  expenseSchema,
  moveMoneySchema,
  savingGoalSchema,
  authEmailSchema,
  customCategorySchema,
} from '../src/lib/validation';

describe('Zod Form Validation Schemas', () => {
  it('rejects empty, NaN, Infinity, negative, or absurd money amounts', () => {
    assert.strictEqual(moneyAmountSchema.safeParse(-10).success, false);
    assert.strictEqual(moneyAmountSchema.safeParse(NaN).success, false);
    assert.strictEqual(moneyAmountSchema.safeParse(Infinity).success, false);
    assert.strictEqual(moneyAmountSchema.safeParse(2000000000).success, false); // > 1B
    assert.strictEqual(moneyAmountSchema.safeParse(100).success, true);
    assert.strictEqual(moneyAmountSchema.safeParse(0).success, true);
  });

  it('validates expense schema correctly', () => {
    const validExpense = {
      name: 'Supermarket',
      amount: 150.5,
      type: 'Groceries',
      date: '2026-07-26',
      place: 'bank',
    };
    assert.strictEqual(expenseSchema.safeParse(validExpense).success, true);

    const invalidExpense = {
      name: '', // empty name
      amount: 0, // amount must be > 0
      type: 'Groceries',
      date: '2026-07-26',
      place: 'invalid-place',
    };
    assert.strictEqual(expenseSchema.safeParse(invalidExpense).success, false);
  });

  it('validates move money schema and rejects same-account transfer', () => {
    const sameAccount = {
      from: 'bank',
      to: 'bank',
      amount: 500,
    };
    assert.strictEqual(moveMoneySchema.safeParse(sameAccount).success, false);

    const validTransfer = {
      from: 'bank',
      to: 'home',
      amount: 500,
    };
    assert.strictEqual(moveMoneySchema.safeParse(validTransfer).success, true);
  });

  it('validates saving goal schema', () => {
    const validGoal = { name: 'Emergency Fund', target: 10000, source: 'bank' };
    assert.strictEqual(savingGoalSchema.safeParse(validGoal).success, true);

    const invalidGoal = { name: '', target: -500, source: 'bank' };
    assert.strictEqual(savingGoalSchema.safeParse(invalidGoal).success, false);
  });

  it('validates auth email schema', () => {
    assert.strictEqual(authEmailSchema.safeParse('test@example.com').success, true);
    assert.strictEqual(authEmailSchema.safeParse('not-an-email').success, false);
  });

  it('validates custom category schema with hex color code', () => {
    const validCategory = { name: 'Gym', color: '#00685f', icon: 'fitness_center' };
    assert.strictEqual(customCategorySchema.safeParse(validCategory).success, true);

    const invalidCategory = { name: 'Gym', color: 'blue', icon: 'fitness_center' };
    assert.strictEqual(customCategorySchema.safeParse(invalidCategory).success, false);
  });
});
