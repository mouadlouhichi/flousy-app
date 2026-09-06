import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaceLedger } from '../src/lib/place-ledger';
import type { MonthBudget } from '../src/lib/store';

function baseMonth(): MonthBudget {
  return {
    bankPart: 5950,
    homePart: 0,
    walletPart: 0,
    placeBalances: { 'my-paypal': 0 },
    periodStartDate: '2026-09-01',
    totalBudget: 10000,
    strategyId: '50-30-20',
    monthlySavingsTarget: 2000,
    variableExpenses: [],
    fixedExpenses: [],
    variableCategoryBases: {},
    fixedCategoryBases: {},
    activeCategories: [],
    categoryColors: {},
    categoryIcons: {},
    incomeSources: [],
    transfers: [],
    balanceAdjustments: [],
    savingsActivity: [],
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

describe('buildPlaceLedger', () => {
  it('renders a bank-style statement newest first with a running balance', () => {
    const month = baseMonth();
    month.bankPart = 5950; // 10000 income − 3000 rent − 450 market − 500 transfer − 200 savings + 100 adjustment
    month.incomeSources = [{
      id: 'salary', name: 'Primary Income', amount: 10000, status: 'paid',
      receivedAmount: 10000, receivedAt: '2026-09-01T08:00:00.000Z', recurring: true,
    }];
    month.fixedExpenses = [{
      id: 'rent', name: 'Rent', amount: 3000, paidAmount: 3000, status: 'paid',
      type: 'Rent', place: 'bank', date: '1st', paidAt: '2026-09-01T08:05:00.000Z', recurring: true,
    }];
    month.variableExpenses = [{
      id: 'v2', name: 'Carrefour', amount: 450, type: 'Groceries', date: '2026-09-05', place: 'bank',
    }];
    month.transfers = [{
      id: 't1', from: 'bank', to: 'wallet', amount: 500, date: '2026-09-06T10:00:00.000Z',
    }];
    month.savingsActivity = [{
      id: 's1', goalId: 'g1', goalName: 'Holiday', type: 'deposit', amount: 200,
      date: '2026-09-07T09:00:00.000Z', place: 'bank',
    }];
    month.balanceAdjustments = [{
      id: 'a1', place: 'bank', previousBalance: 5850, newBalance: 5950, delta: 100,
      reason: 'reconciliation', note: 'Cash found', date: '2026-09-08T12:00:00.000Z',
    }];

    const ledger = buildPlaceLedger(month, 'bank');
    assert.strictEqual(ledger.currentBalance, 5950);
    assert.strictEqual(ledger.openingBalance, 0);
    assert.deepEqual(
      ledger.rows.map((row) => row.kind),
      ['adjustment', 'savings', 'transfer', 'expense', 'bill', 'income'],
    );
    // Newest row shows the current balance, then each older row steps back.
    assert.deepEqual(
      ledger.rows.map((row) => row.balance),
      [5950, 5850, 6050, 6550, 7000, 10000],
    );
    assert.deepEqual(
      ledger.rows.map((row) => row.delta),
      [100, -200, -500, -450, -3000, 10000],
    );
  });

  it('keeps same-day expense rows in add-recency order (most recent added first)', () => {
    const month = baseMonth();
    month.bankPart = 60;
    // variableExpenses is newest-first: the 40 spent at Zebra Cafe was added
    // AFTER the 20 spent at Apple Store.
    month.variableExpenses = [
      { id: 'newer', name: 'Zebra Cafe', amount: 40, type: 'Food', date: '2026-09-05', place: 'bank' },
      { id: 'older', name: 'Apple Store', amount: 20, type: 'Shopping', date: '2026-09-05', place: 'bank' },
    ];
    const ledger = buildPlaceLedger(month, 'bank');
    assert.deepEqual(
      ledger.rows.map((row) => row.id),
      ['expense-newer', 'expense-older'],
    );
    assert.deepEqual(
      ledger.rows.map((row) => row.balance),
      [60, 100],
    );
  });

  it('attaches transfers from and to a non-bank place with the right signs', () => {
    const month = baseMonth();
    month.bankPart = 8500;
    month.walletPart = 880; // 1000 transfer in − 120 expense
    month.transfers = [{
      id: 't1', from: 'bank', to: 'wallet', amount: 1000, date: '2026-09-03T12:00:00.000Z',
    }];
    month.variableExpenses = [{
      id: 'w1', name: 'Bread', amount: 120, type: 'Groceries', date: '2026-09-04', place: 'wallet',
    }];

    const wallet = buildPlaceLedger(month, 'wallet');
    assert.strictEqual(wallet.currentBalance, 880);
    assert.deepEqual(
      wallet.rows.map((row) => [row.kind, row.delta, row.balance]),
      [['expense', -120, 880], ['transfer', 1000, 1000]],
    );

    const bank = buildPlaceLedger(month, 'bank');
    assert.deepEqual(
      bank.rows.map((row) => [row.kind, row.delta]),
      [['transfer', -1000]],
    );
    assert.strictEqual(bank.currentBalance, 8500);
    assert.strictEqual(bank.openingBalance, 9500);
  });

  it('supports custom (placeBalances) places', () => {
    const month = baseMonth();
    month.placeBalances = { 'my-paypal': 430 };
    month.transfers = [{
      id: 't1', from: 'bank', to: 'my-paypal', amount: 430, date: '2026-09-02T09:00:00.000Z',
    }];
    const ledger = buildPlaceLedger(month, 'my-paypal');
    assert.strictEqual(ledger.currentBalance, 430);
    assert.deepEqual(ledger.rows.map((row) => row.delta), [430]);
    assert.strictEqual(ledger.openingBalance, 0);
  });

  it('recomputes the opening balance when rows are filtered out (RBAC)', () => {
    const month = baseMonth();
    month.bankPart = 5500; // 10000 income − 4500 expense
    month.incomeSources = [{
      id: 'salary', name: 'Primary Income', amount: 10000, status: 'paid',
      receivedAmount: 10000, receivedAt: '2026-09-01T08:00:00.000Z', recurring: true,
    }];
    month.variableExpenses = [{
      id: 'v1', name: 'Marjane', amount: 4500, type: 'Groceries', date: '2026-09-05', place: 'bank',
    }];

    const full = buildPlaceLedger(month, 'bank');
    assert.strictEqual(full.rows.length, 2);
    assert.strictEqual(full.openingBalance, 0);

    const noExpenses = buildPlaceLedger(month, 'bank', { include: { expenses: false } });
    assert.deepEqual(noExpenses.rows.map((row) => row.kind), ['income']);
    // Top row still reconciles to the live card balance…
    assert.strictEqual(noExpenses.rows[0].balance, 5500);
    // …because the hidden expense is folded into the opening.
    assert.strictEqual(noExpenses.openingBalance, -4500);
  });

  it('omits planned fixed bills that never moved cash', () => {
    const month = baseMonth();
    month.bankPart = 7000;
    month.fixedExpenses = [
      {
        id: 'planned', name: 'Rent', amount: 3000, paidAmount: 0, status: 'planned',
        type: 'Rent', place: 'bank', date: '1st', recurring: true,
      },
    ];
    const ledger = buildPlaceLedger(month, 'bank');
    assert.strictEqual(ledger.rows.length, 0);
    assert.strictEqual(ledger.openingBalance, 7000);
  });

  it('falls back to the period start for legacy paid bills without paidAt', () => {
    const month = baseMonth();
    month.bankPart = 7000;
    month.fixedExpenses = [{
      id: 'legacy', name: 'Rent', amount: 3000, paidAmount: 3000, status: 'paid',
      type: 'Rent', place: 'bank', date: '1st', recurring: true,
    }];
    const ledger = buildPlaceLedger(month, 'bank');
    assert.strictEqual(ledger.rows[0].day, '2026-09-01');
    assert.strictEqual(ledger.rows[0].instant, undefined);
    assert.strictEqual(ledger.rows[0].delta, -3000);
  });

  it('labels savings withdrawals as money back into the place', () => {
    const month = baseMonth();
    month.bankPart = 3200;
    month.savingsActivity = [
      { id: 'dep', goalId: 'g1', goalName: 'Holiday', type: 'deposit', amount: 500, date: '2026-09-02T09:00:00.000Z', place: 'bank' },
      { id: 'wd', goalId: 'g1', goalName: 'Holiday', type: 'withdraw', amount: 200, date: '2026-09-03T09:00:00.000Z', place: 'bank' },
    ];
    const ledger = buildPlaceLedger(month, 'bank');
    assert.deepEqual(
      ledger.rows.map((row) => [row.id, row.delta]),
      [['savings-wd', 200], ['savings-dep', -500]],
    );
    assert.strictEqual(ledger.openingBalance, 3500);
    assert.strictEqual(ledger.rows[0].balance, 3200);
  });
});
