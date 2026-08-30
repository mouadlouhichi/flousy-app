import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAvailableBalance,
  insufficientFundsMessage,
  MONEY_PLACE_LABELS,
} from '../src/lib/money-places';
import {
  MonthBudget,
  addVariableExpense,
  addFixedExpense,
  createNewMonth,
  fundGoal,
} from '../src/lib/store';

const format = (value: number) => `${value.toFixed(2)} MAD`;

const balances = { bank: 1000, home: 200, wallet: 50 };

describe('Money place balances (expense / savings source checks)', () => {
  it('returns null when no balances are supplied, which disables the check', () => {
    assert.equal(getAvailableBalance(undefined, 'bank'), null);
    assert.equal(getAvailableBalance(null, 'bank'), null);
  });

  it('reports the balance of the selected place', () => {
    assert.equal(getAvailableBalance(balances, 'bank'), 1000);
    assert.equal(getAvailableBalance(balances, 'home'), 200);
    assert.equal(getAvailableBalance(balances, 'wallet'), 50);
  });

  it('refunds the old entry first when it was taken from the same place', () => {
    // Editing a 300 MAD bank expense leaves 1000 + 300 available in bank.
    assert.equal(
      getAvailableBalance(balances, 'bank', { place: 'bank', amount: 300 }),
      1300,
    );

    // Re-saving the very same expense must always be allowed.
    assert.equal(
      insufficientFundsMessage(1300, getAvailableBalance(balances, 'bank', { place: 'bank', amount: 300 })!, 'bank', format),
      null,
    );
  });

  it('does not refund an entry that lived in another place', () => {
    // Moving a 300 MAD wallet expense to bank: bank keeps its own 1000.
    assert.equal(
      getAvailableBalance(balances, 'bank', { place: 'wallet', amount: 300 }),
      1000,
    );
    assert.equal(
      getAvailableBalance(balances, 'wallet', { place: 'wallet', amount: 300 }),
      350,
    );
  });

  it('treats a missing / non-finite balance as empty', () => {
    assert.equal(getAvailableBalance({ bank: undefined }, 'bank'), 0);
    assert.equal(getAvailableBalance({ bank: Number.NaN }, 'bank'), 0);
  });

  describe('insufficientFundsMessage', () => {
    it('is null when the place can cover the amount', () => {
      assert.equal(insufficientFundsMessage(1000, 1000, 'bank', format), null);
      assert.equal(insufficientFundsMessage(999.99, 1000, 'bank', format), null);
    });

    it('explains the shortfall when it cannot', () => {
      const message = insufficientFundsMessage(1500, 1000, 'bank', format);
      assert.equal(message, 'Not enough money in Bank. Available: 1000.00 MAD');
    });

    it('names the place with its friendly label', () => {
      const message = insufficientFundsMessage(500, 200, 'home', format);
      assert.match(String(message), new RegExp(MONEY_PLACE_LABELS.home));
      assert.equal(message, 'Not enough money in Home Cash. Available: 200.00 MAD');
    });

    it('ignores empty / invalid amounts and floating-point dust', () => {
      assert.equal(insufficientFundsMessage(0, 100, 'bank', format), null);
      assert.equal(insufficientFundsMessage(Number.NaN, 100, 'bank', format), null);
      // 0.1 + 0.2 style rounding must not block a legitimate save.
      assert.equal(insufficientFundsMessage(0.30000000000000004, 0.3, 'bank', format), null);
    });
  });

  describe('store guards (why the UI has to check first)', () => {
    const newMonth = (): MonthBudget => createNewMonth(10000, '50-30-20', [], [], '2026-08');

    it('clamping an overdrawn expense would lose money silently', () => {
      const month = { ...newMonth(), bankPart: 100 };
      const overdrawn = addVariableExpense(month, {
        id: 'e1',
        name: 'Too expensive',
        amount: 500,
        type: 'Groceries',
        date: '2026-08-02',
        place: 'bank',
      });

      // The place bottoms out at 0 while the expense still records 500 —
      // exactly the inconsistency the modal now refuses up front.
      assert.equal(overdrawn.bankPart, 0);
      assert.equal(overdrawn.variableExpenses[0].amount, 500);
    });

    it('clamping an overdrawn fixed bill would lose money silently', () => {
      const month = { ...newMonth(), bankPart: 100 };
      const overdrawn = addFixedExpense(month, {
        id: 'b1',
        name: 'Rent',
        amount: 900,
        type: 'Housing',
        date: '1st',
        place: 'bank',
      });

      assert.equal(overdrawn.bankPart, 0);
      assert.equal(overdrawn.fixedExpenses[0].amount, 900);
    });

    it('funding a goal above the source balance only moves what exists', () => {
      const month = { ...newMonth(), bankPart: 100 };
      const goals = [
        { id: 'g1', name: 'Trip', target: 5000, current: 0, source: 'bank' as const, active: true },
      ];

      const res = fundGoal(month, goals, 'g1', 500, 'bank');

      assert.equal(res.month.bankPart, 0);
      assert.equal(res.goals[0].current, 100); // silently short of the 500 asked for
    });
  });
});
