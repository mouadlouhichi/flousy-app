import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exportMonthToCsv } from '../src/lib/export';
import { exportSectionsFor } from '../src/lib/household-rbac';
import { normalizeMonth, SavingGoal } from '../src/lib/store';

describe('CSV Export Utilities', () => {
  it('neutralizes CSV formula injection attempts', () => {
    const month = normalizeMonth({
      totalBudget: 5000,
      variableExpenses: [
        {
          id: 'v1',
          name: '=SUM(1+1)',
          type: '+DANGEROUS',
          amount: 100,
          date: '2026-07-01',
          place: 'bank',
        },
      ],
    });

    const csv = exportMonthToCsv(month, [], '2026-07', 'MAD');

    // Should escape formula triggers with a leading single quote `'`
    assert.ok(csv.includes('"\'=SUM(1+1)"'));
    assert.ok(csv.includes('"\'=SUM(1+1)","\'+DANGEROUS"'));
  });

  it('handles empty month data and empty savings goals without errors', () => {
    const month = normalizeMonth({});
    const csv = exportMonthToCsv(month, [], '2026-07', 'MAD');

    assert.ok(csv.includes('SmartJib Financial Export - 2026-07'));
    assert.ok(csv.includes('"No fixed charges recorded"'));
    assert.ok(csv.includes('"No variable expenses recorded"'));
    assert.ok(csv.includes('"No active savings goals"'));
  });

  it('exports variable expenses, fixed charges, and savings goals in correct order', () => {
    const month = normalizeMonth({
      totalBudget: 10000,
      fixedExpenses: [
        { id: 'f1', name: 'Rent', amount: 3000, type: 'Housing', date: '1st', place: 'bank' },
      ],
      variableExpenses: [
        { id: 'v1', name: 'Marjane', amount: 500, type: 'Groceries', date: '2026-07-15', place: 'bank' },
      ],
    });

    const goals: SavingGoal[] = [
      { id: 'g1', name: 'New Car', target: 50000, current: 12000, source: 'bank', active: true },
    ];

    const csv = exportMonthToCsv(month, goals, '2026-07', 'MAD');

    assert.ok(csv.includes('"Rent","Housing","3000","bank"'));
    assert.ok(csv.includes('"2026-07-15","Marjane","Groceries","500","bank"'));
    assert.ok(csv.includes('"New Car","12000","50000","bank"'));
  });

  it('reports total cash on hand including custom money places', () => {
    const month = normalizeMonth({
      bankPart: 1000,
      homePart: 200,
      walletPart: 300,
      placeBalances: { piggy: 500 },
    });

    const csv = exportMonthToCsv(month, [], '2026-07', 'MAD');

    // 1000 + 200 + 300 + 500 (custom place) — previously the custom place was
    // left out, so the CSV disagreed with the dashboard's TOTAL CASH ON HAND.
    assert.ok(csv.includes('"1000","200","300","2000"'));
  });

  it('omits sections the household role may not view', () => {
    const month = normalizeMonth({
      bankPart: 1000,
      fixedExpenses: [{ id: 'f1', name: 'Rent', amount: 3000, type: 'Housing', date: '1st', place: 'bank' }],
      variableExpenses: [{ id: 'v1', name: 'Marjane', amount: 500, type: 'Groceries', date: '2026-07-15', place: 'bank' }],
    });
    const goals: SavingGoal[] = [
      { id: 'g1', name: 'New Car', target: 50000, current: 12000, source: 'bank', active: true },
    ];

    // A contributor may only see expenses: no balances, fixed bills or savings.
    const csv = exportMonthToCsv(month, goals, '2026-07', 'MAD', exportSectionsFor('contributor'));

    assert.equal(csv.includes('MONEY PLACES BALANCES'), false);
    assert.equal(csv.includes('FIXED CHARGES'), false);
    assert.equal(csv.includes('SAVINGS GOALS'), false);
    assert.equal(csv.includes('"Rent"'), false);
    assert.equal(csv.includes('"New Car"'), false);
    assert.ok(csv.includes('VARIABLE EXPENSES'));
    assert.ok(csv.includes('"Marjane"'));
  });

  it('keeps every section for an owner export', () => {
    const month = normalizeMonth({ bankPart: 1000 });
    const csv = exportMonthToCsv(month, [], '2026-07', 'MAD', exportSectionsFor('owner'));

    assert.ok(csv.includes('MONEY PLACES BALANCES'));
    assert.ok(csv.includes('FIXED CHARGES'));
    assert.ok(csv.includes('VARIABLE EXPENSES'));
    assert.ok(csv.includes('SAVINGS GOALS'));
  });

  it('produces a header-only file when no section is viewable', () => {
    const month = normalizeMonth({ bankPart: 1000 });
    const csv = exportMonthToCsv(month, [], '2026-07', 'MAD', exportSectionsFor(undefined));

    assert.ok(csv.includes('SmartJib Financial Export - 2026-07'));
    assert.equal(csv.includes('MONEY PLACES BALANCES'), false);
    assert.equal(csv.includes('VARIABLE EXPENSES'), false);
    assert.equal(csv.includes('1000'), false);
  });
});
