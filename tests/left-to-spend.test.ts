import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSafeToSpend } from '../src/lib/insights';
import { calculateEnvelopeAmounts, calculateEnvelopeSpent, type MonthBudget } from '../src/lib/store';

/**
 * Regression: the overview ring showed `totalBudget − spent` as "Left to
 * spend" while analytics used the needs + wants envelope. Both screens now
 * read `calculateSafeToSpend().remainingBudget`; this pins the shared basis.
 */
function month(): MonthBudget {
  return {
    totalBudget: 20000,
    strategyId: '50-30-20',
    periodKey: '2026-09',
    periodStartDate: '2026-09-01',
    periodEndDate: '2026-09-30',
    bankPart: 7500.1,
    homePart: 0,
    walletPart: 160,
    variableExpenses: [
      { id: 'v1', name: 'Groceries', amount: 1500, type: 'Groceries', date: '2026-09-03', place: 'bank' },
      { id: 'v2', name: 'Cinema', amount: 300, type: 'Entertainment', date: '2026-09-05', place: 'wallet' },
    ],
    fixedExpenses: [
      { id: 'f1', name: 'Rent', amount: 4000, type: 'Rent', place: 'bank', status: 'paid', paidAmount: 4000 },
      { id: 'f2', name: 'Internet', amount: 300, type: 'Utilities', place: 'bank', status: 'planned' },
    ],
    incomeSources: [],
    savingsActivity: [],
    debts: [],
  } as unknown as MonthBudget;
}

describe('left to spend', () => {
  it('excludes the savings envelope from the spendable budget', () => {
    const m = month();
    const { needs, wants, savings } = calculateEnvelopeAmounts(m.totalBudget, m.strategyId, m.customRatios);
    const spent = calculateEnvelopeSpent(m).totalSpent;
    const s = calculateSafeToSpend(m, new Date('2026-09-10T12:00:00Z'));

    assert.equal(s.budget, needs + wants);
    assert.equal(s.remainingBudget, needs + wants - spent);
    // The old overview figure counted the savings envelope as spendable.
    assert.equal(m.totalBudget - spent, s.remainingBudget + savings);
    assert.ok(s.remainingBudget < m.totalBudget - spent);
  });

  it('never goes negative when spending exceeds the envelope', () => {
    const m = month();
    m.variableExpenses = [{ id: 'big', name: 'Car', amount: 50000, type: 'Transport', date: '2026-09-02', place: 'bank' }] as MonthBudget['variableExpenses'];
    assert.equal(calculateSafeToSpend(m, new Date('2026-09-10T12:00:00Z')).remainingBudget, 0);
  });
});
