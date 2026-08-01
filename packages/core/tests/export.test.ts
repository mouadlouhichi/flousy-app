import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exportMonthToCsv } from '../src/export';
import { normalizeMonth, SavingGoal } from '../src/store';

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
});
