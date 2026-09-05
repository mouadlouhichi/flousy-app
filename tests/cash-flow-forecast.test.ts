import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCashFlowForecast } from '../src/lib/insights';
import type { MonthBudget } from '../src/lib/store';

function month(): MonthBudget {
  return {
    totalBudget: 10000,
    strategyId: '50-30-20',
    periodStartDate: '2026-09-01',
    periodEndDate: '2026-09-30',
    periodKey: '2026-09',
    bankPart: 4000,
    homePart: 0,
    walletPart: 500,
    fixedExpenses: [
      { id: 'rent', name: 'Rent', amount: 3000, type: 'Rent', date: '5th', place: 'bank', status: 'paid', paidAmount: 3000 },
      { id: 'phone', name: 'Phone', amount: 200, type: 'Phone', date: '20th', place: 'bank', status: 'planned' },
      { id: 'elec', name: 'Electricity', amount: 400, type: 'Utilities', date: '2026-09-25', place: 'bank', status: 'partial', paidAmount: 100 },
    ],
    variableExpenses: [
      { id: 'v1', name: 'Groceries', amount: 300, type: 'Food', date: '2026-09-02', place: 'wallet' },
      { id: 'v2', name: 'Taxi', amount: 100, type: 'Transport', date: '2026-09-05', place: 'wallet' },
    ],
    incomeSources: [
      { id: 'salary', name: 'Salary', amount: 8000, status: 'planned', receivedAmount: 0, payDay: 28 },
    ],
    debts: [],
  } as unknown as MonthBudget;
}

describe('buildCashFlowForecast', () => {
  const today = new Date(2026, 8, 10); // 10 Sep 2026

  it('lays out one day per period day with events on due / pay days', () => {
    const f = buildCashFlowForecast(month(), today);
    assert.equal(f.days.length, 30);
    assert.equal(f.days[0]!.date, '2026-09-01');
    const rent = f.days.find((d) => d.date === '2026-09-05')!;
    assert.equal(rent.events[0]!.name, 'Rent');
    assert.equal(rent.events[0]!.settled, true);
    const salary = f.days.find((d) => d.date === '2026-09-28')!;
    assert.equal(salary.events[0]!.kind, 'income');
    assert.equal(salary.events[0]!.pending, 8000);
  });

  it('projects cash: burn per day, bills subtracted, income added', () => {
    const f = buildCashFlowForecast(month(), today);
    assert.equal(f.startingCash, 4500);
    // 400 variable over 10 elapsed days = 40/day
    assert.equal(f.dailyBurn, 40);
    const d11 = f.days.find((d) => d.date === '2026-09-11')!;
    assert.equal(d11.balance, 4460);
    const d20 = f.days.find((d) => d.date === '2026-09-20')!;
    assert.equal(d20.balance, 4500 - 40 * 10 - 200);
    const d25 = f.days.find((d) => d.date === '2026-09-25')!;
    assert.equal(d25.balance, 4500 - 40 * 15 - 200 - 300);
    const d28 = f.days.find((d) => d.date === '2026-09-28')!;
    assert.equal(d28.balance, 4500 - 40 * 18 - 500 + 8000);
    assert.equal(f.endBalance, 4500 - 40 * 20 - 500 + 8000);
    assert.equal(f.pendingBills, 500);
    assert.equal(f.pendingIncome, 8000);
  });

  it('reports the next unpaid bill and the lowest dip', () => {
    const f = buildCashFlowForecast(month(), today);
    assert.equal(f.nextBill?.name, 'Phone');
    assert.equal(f.nextBill?.daysUntil, 10);
    assert.equal(f.lowest.date, '2026-09-27');
  });

  it('keeps past days at today\'s cash and marks today', () => {
    const f = buildCashFlowForecast(month(), today);
    const past = f.days.find((d) => d.date === '2026-09-03')!;
    assert.equal(past.isPast, true);
    assert.equal(past.balance, 4500);
    assert.equal(f.days.find((d) => d.isToday)!.date, '2026-09-10');
  });
});
