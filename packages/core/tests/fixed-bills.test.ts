import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FixedExpense,
  MonthBudget,
  addFixedExpense,
  availableForCharge,
  carryOverFixedExpenses,
  deleteFixedExpense,
  editFixedExpense,
  getPlaceBalance,
} from '../src/store';

const bill = (overrides: Partial<FixedExpense> = {}): FixedExpense => ({
  id: overrides.id || 'bill-1',
  name: overrides.name || 'Electricity',
  amount: overrides.amount ?? 300,
  type: overrides.type || 'Utilities',
  date: overrides.date || '5th',
  place: overrides.place || 'bank',
  recurring: overrides.recurring ?? true,
});

const monthWith = (
  parts: { bank?: number; home?: number; wallet?: number },
  fixed: FixedExpense[] = [],
): MonthBudget => ({
  totalBudget: (parts.bank || 0) + (parts.home || 0) + (parts.wallet || 0),
  bankPart: parts.bank || 0,
  homePart: parts.home || 0,
  walletPart: parts.wallet || 0,
  strategyId: '50-30-20',
  monthlySavingsTarget: 0,
  variableExpenses: [],
  fixedExpenses: fixed,
  variableCategoryBases: {},
  fixedCategoryBases: {},
  activeCategories: [],
  categoryColors: {},
  categoryIcons: {},
  updatedAt: new Date().toISOString(),
});

describe('Fixed bills reduce their own source', () => {
  it('deducts the full amount from the place the bill is paid from', () => {
    const month = monthWith({ bank: 5000, home: 800, wallet: 200 });

    const next = addFixedExpense(month, bill({ place: 'wallet', amount: 150 }));
    assert.strictEqual(next.walletPart, 50);
    assert.strictEqual(next.bankPart, 5000);
    assert.strictEqual(next.homePart, 800);
    assert.strictEqual(next.fixedExpenses.length, 1);
  });

  it('nets the delta against the same source when a bill is edited', () => {
    const original = bill({ place: 'bank', amount: 900 });
    let month = addFixedExpense(monthWith({ bank: 5000 }), original);
    assert.strictEqual(month.bankPart, 4100);

    month = editFixedExpense(month, original, { ...original, amount: 1200 });
    assert.strictEqual(month.bankPart, 3800); // 5000 - 1200

    month = editFixedExpense(month, { ...original, amount: 1200 }, { ...original, amount: 700 });
    assert.strictEqual(month.bankPart, 4300); // 5000 - 700
  });

  it('moves the charge between sources when a bill is edited to another place', () => {
    const original = bill({ place: 'bank', amount: 1000 });
    let month = addFixedExpense(monthWith({ bank: 5000, wallet: 1400 }), original);

    month = editFixedExpense(month, original, { ...original, place: 'wallet' });
    assert.strictEqual(month.bankPart, 5000, 'old source is refunded');
    assert.strictEqual(month.walletPart, 400, 'new source is charged exactly');
  });

  it('refunds the source when a bill is deleted', () => {
    const original = bill({ place: 'home', amount: 250 });
    let month = addFixedExpense(monthWith({ bank: 5000, home: 800 }), original);
    assert.strictEqual(month.homePart, 550);

    month = deleteFixedExpense(month, original);
    assert.strictEqual(month.homePart, 800);
  });
});

describe('carryOverFixedExpenses', () => {
  it('carries recurring bills and debits each from its own place', () => {
    const previous = monthWith({}, [
      bill({ id: 'rent', amount: 3500, place: 'bank', name: 'Rent' }),
      bill({ id: 'gym', amount: 200, place: 'wallet', name: 'Gym' }),
      bill({ id: 'maid', amount: 400, place: 'home', name: 'Maid' }),
      bill({ id: 'oneoff', amount: 999, place: 'bank', recurring: false, name: 'One-off' }),
    ]);
    const fresh = monthWith({ bank: 15000, home: 1000, wallet: 500 });

    const next = carryOverFixedExpenses(fresh, previous);

    assert.strictEqual(next.fixedExpenses.length, 3, 'non-recurring bill is not carried');
    assert.strictEqual(next.bankPart, 15000 - 3500, 'bank bill debits bank');
    assert.strictEqual(next.homePart, 1000 - 400, 'home bill debits home cash');
    assert.strictEqual(next.walletPart, 500 - 200, 'wallet bill debits wallet');
  });

  it('never drives a source below zero and skips bills already present', () => {
    const previous = monthWith({}, [
      bill({ id: 'rent', amount: 3500, place: 'bank' }),
      bill({ id: 'gym', amount: 200, place: 'wallet' }),
    ]);
    const fresh = monthWith(
      { bank: 2000, wallet: 50 },
      [bill({ id: 'rent', amount: 3500, place: 'bank' })],
    );

    const next = carryOverFixedExpenses(fresh, previous);

    assert.strictEqual(next.fixedExpenses.length, 2, 'rent already exists, only gym is added');
    assert.strictEqual(next.bankPart, 2000, 'existing rent is not debited again');
    assert.strictEqual(next.walletPart, 0, 'wallet clamps at zero instead of going negative');
  });

  it('returns the month untouched when there is nothing to carry', () => {
    const fresh = monthWith({ bank: 15000 });
    assert.strictEqual(carryOverFixedExpenses(fresh, monthWith({})), fresh, 'no previous bills');

    const withRent = monthWith({ bank: 15000 }, [bill({ id: 'rent' })]);
    const previous = monthWith({}, [bill({ id: 'rent' })]);
    assert.strictEqual(carryOverFixedExpenses(withRent, previous), withRent, 'all bills already present');
  });
});

describe('availableForCharge (source-has-enough-money guard)', () => {
  const balances = { bank: 1200, home: 300, wallet: 50 };

  it('a new charge is capped by the selected place balance', () => {
    assert.strictEqual(availableForCharge(balances, 'bank'), 1200);
    assert.strictEqual(availableForCharge(balances, 'home'), 300);
    assert.strictEqual(availableForCharge(balances, 'wallet'), 50);
  });

  it('editing a charge in the same place refunds its old amount first', () => {
    const previous = { place: 'bank' as const, amount: 900 };
    assert.strictEqual(availableForCharge(balances, 'bank', previous), 2100);
    assert.strictEqual(availableForCharge(balances, 'home', previous), 300, 'other places are unaffected');
  });

  it('moving a charge to another place only counts the new place', () => {
    const previous = { place: 'bank' as const, amount: 900 };
    assert.strictEqual(availableForCharge(balances, 'wallet', previous), 50);
  });

  it('treats a legacy charge without a place as paid from bank', () => {
    const previous = { amount: 900 };
    assert.strictEqual(availableForCharge(balances, 'bank', previous), 2100);
  });

  it('handles missing balances defensively', () => {
    assert.strictEqual(availableForCharge(undefined, 'bank'), 0);
    assert.strictEqual(availableForCharge({ bank: undefined, home: 10, wallet: 0 }, 'bank'), 0);
  });

  it('getPlaceBalance reads the month parts', () => {
    const month = monthWith({ bank: 1200, home: 300, wallet: 50 });
    assert.strictEqual(getPlaceBalance(month, 'bank'), 1200);
    assert.strictEqual(getPlaceBalance(month, 'home'), 300);
    assert.strictEqual(getPlaceBalance(month, 'wallet'), 50);
  });
});
