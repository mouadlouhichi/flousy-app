import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MonthBudget,
  Envelope,
  addDebt,
  addFixedExpense,
  addVariableExpense,
  bucketOf,
  calculateCategoryBudgets,
  calculateEnvelopeSpent,
  calculateSavingsRate,
  carryOverDebts,
  envelopeFor,
  getUpcomingBills,
  normalizeMonth,
  recordDebtPayment,
  setCategoryEnvelope,
} from '../src/lib/store';

function baseMonth(overrides: Partial<MonthBudget> = {}): MonthBudget {
  return normalizeMonth({
    totalBudget: 10000,
    periodKey: '2026-09',
    ...overrides,
  }, '2026-09');
}

describe('Explicit category envelopes (needs/wants override)', () => {
  it('an explicit override wins over the keyword guess', () => {
    // "Medicine" is mis-bucketed as a want by the keyword list.
    assert.equal(bucketOf('Medicine', 'variable'), 'wants');
    const envelopes = { Medicine: 'needs' as Envelope };
    assert.equal(envelopeFor(envelopes, 'Medicine', 'variable'), 'needs');
    assert.equal(envelopeFor(undefined, 'Medicine', 'variable'), 'wants');
  });

  it('setCategoryEnvelope updates envelope spending immediately', () => {
    let month = baseMonth();
    month = addVariableExpense(month, {
      id: 'e1', name: 'Pharmacy', amount: 200, type: 'Medicine',
      date: '2026-09-10', place: 'bank',
    });
    assert.equal(calculateEnvelopeSpent(month).needs, 0);
    assert.equal(calculateEnvelopeSpent(month).wants, 200);

    month = setCategoryEnvelope(month, 'Medicine', 'needs');
    assert.equal(calculateEnvelopeSpent(month).needs, 200);
    assert.equal(calculateEnvelopeSpent(month).wants, 0);
  });

  it('normalizeMonth seeds default envelopes matching historical keyword results', () => {
    const month = baseMonth();
    assert.equal(month.categoryEnvelopes?.Groceries, 'needs');
    assert.equal(month.categoryEnvelopes?.['Dining Out'], 'wants');
    // Envelope math for the default categories is unchanged by the seeding.
    const spent = calculateEnvelopeSpent(
      addVariableExpense(month, {
        id: 'e2', name: 'Market', amount: 100, type: 'Groceries',
        date: '2026-09-02', place: 'bank',
      }),
    );
    assert.equal(spent.needs, 100);
  });

  it('calculateCategoryBudgets honours envelope overrides', () => {
    const budgets = calculateCategoryBudgets(
      1000, '50-30-20', ['Medicine', 'Dining Out'], 'variable', undefined, { Medicine: 'needs' },
    );
    // Needs envelope (500) goes entirely to Medicine; Dining Out gets the wants share.
    assert.equal(budgets.Medicine, 500);
    assert.equal(budgets['Dining Out'], 300);
  });

  it('ignores malformed stored envelopes', () => {
    assert.equal(envelopeFor({ Bad: 'nonsense' as unknown as Envelope }, 'Bad', 'variable'), 'wants');
    assert.equal(envelopeFor({ Groceries: 'needs' }, 'Groceries', 'variable'), 'needs');
  });
});

describe('Debt carry-over across periods', () => {
  const openDebt = {
    id: 'debt-1', name: 'Loan', amount: 1000, type: 'debt' as const,
    status: 'open' as const, date: '2026-09-01',
  };

  it('open debts carry into the next period with payment history', () => {
    const september = addDebt(baseMonth(), openDebt);
    const paid = recordDebtPayment(september, 'debt-1', {
      id: 'pay-1', amount: 400, date: '2026-09-15', place: 'bank',
    });
    const october = carryOverDebts(baseMonth({ periodKey: '2026-10' } as Partial<MonthBudget>), paid);

    assert.equal(october.debts?.length, 1);
    const carried = october.debts![0];
    assert.equal(carried.carriedFromId, 'debt-1');
    assert.match(carried.id, /^debt-carry-debt-1-2026-10$/);
    // Outstanding reflects the payment made in September.
    assert.equal(carried.amount - (carried.payments?.reduce((s, p) => s + p.amount, 0) || 0), 600);
  });

  it('carrying twice never duplicates (deterministic ids)', () => {
    const september = addDebt(baseMonth(), openDebt);
    const october = carryOverDebts(baseMonth(), september);
    const octoberAgain = carryOverDebts(october, september);
    assert.equal(octoberAgain.debts?.length, 1);
    // And a second September payment doesn't duplicate into an October that already carried.
    const paidMore = recordDebtPayment(september, 'debt-1', {
      id: 'pay-2', amount: 100, date: '2026-09-20', place: 'bank',
    });
    assert.equal(carryOverDebts(octoberAgain, paidMore).debts?.length, 1);
  });

  it('settled debts stay behind as history', () => {
    const september = addDebt(baseMonth(), openDebt);
    const paid = recordDebtPayment(september, 'debt-1', {
      id: 'pay-full', amount: 1000, date: '2026-09-15', place: 'bank',
    });
    assert.equal(paid.debts![0].status, 'settled');
    const october = carryOverDebts(baseMonth(), paid);
    assert.equal(october.debts?.length ?? 0, 0);
  });

  it('a carried debt is payable inside the new period', () => {
    const september = addDebt(baseMonth(), openDebt);
    const october = carryOverDebts(
      normalizeMonth({ totalBudget: 5000, periodKey: '2026-10' }, '2026-10'),
      september,
    );
    const octoberPaid = recordDebtPayment(october, october.debts![0].id, {
      id: 'pay-oct', amount: 250, date: '2026-10-05', place: 'bank',
    });
    assert.equal(octoberPaid.debts![0].status, 'open');
    assert.equal(octoberPaid.bankPart, 5000 - 250);
  });
});

describe('Upcoming bills', () => {
  it('finds planned/partial bills due within the window, resolved against the period', () => {
    const month = normalizeMonth({
      totalBudget: 5000,
      periodKey: '2026-09',
      fixedExpenses: [
        { id: 'f-rent', name: 'Rent', amount: 2000, type: 'Rent', date: '5th', place: 'bank', status: 'planned', recurring: true },
        { id: 'f-net', name: 'Internet', amount: 300, type: 'Internet', date: '20th', place: 'bank', status: 'partial', paidAmount: 100 },
        { id: 'f-paid', name: 'Phone', amount: 100, type: 'Utilities', date: '6th', place: 'bank', status: 'paid', paidAmount: 100 },
      ],
    }, '2026-09');
    assert.equal(month.periodStartDate, '2026-09-01');

    const today = new Date(2026, 8, 1); // period start day
    const week = getUpcomingBills(month, 7, today);
    assert.deepEqual(
      week.map((b) => b.id),
      ['f-rent'],
    );
    const upcoming = getUpcomingBills(month, 30, today);
    assert.deepEqual(
      upcoming.map((b) => b.id),
      ['f-rent', 'f-net'],
    );
    assert.equal(upcoming[0].daysUntil, 4);
    assert.equal(upcoming[0].remaining, 2000);
    assert.equal(upcoming[1].remaining, 200); // 300 - 100 partial
  });

  it('excludes bills outside the window and skips paid/skipped charges', () => {
    let month = baseMonth();
    month = addFixedExpense(month, {
      id: 'f-late', name: 'Late', amount: 100, type: 'Other', date: '28th',
      place: 'bank', status: 'planned', recurring: false,
    });
    const upcoming = getUpcomingBills(month, 7, new Date(2026, 8, 1));
    assert.equal(upcoming.length, 0);
  });

  it('resolves due days in the next calendar month for shifted periods', () => {
    const month = normalizeMonth({
      totalBudget: 5000,
      periodKey: '2026-09',
      periodStartDay: 25,
      fixedExpenses: [
        { id: 'f-1st', name: 'Streaming', amount: 100, type: 'Subscriptions', date: '1st', place: 'bank', status: 'planned', recurring: true },
      ],
    }, '2026-09');
    // The 2026-09 period starts on the 25th of September.
    assert.equal(month.periodStartDate, '2026-09-25');
    const upcoming = getUpcomingBills(month, 7, new Date(2026, 8, 28)); // Sep 28
    assert.equal(upcoming.length, 1);
    assert.equal(upcoming[0].date, '2026-10-01');
    assert.equal(upcoming[0].daysUntil, 3);
  });
});

describe('Net savings rate', () => {
  it('is received income minus spending over received income', () => {
    const month = normalizeMonth({
      totalBudget: 10000,
      periodKey: '2026-09',
      bankPart: 10000,
      variableExpenses: [
        { id: 'v1', name: 'Market', amount: 3000, type: 'Groceries', date: '2026-09-05', place: 'bank' },
      ],
    }, '2026-09');
    const rate = calculateSavingsRate(month);
    assert.ok(rate);
    assert.equal(rate.net, 7000);
    assert.ok(Math.abs(rate.rate - 0.7) < 1e-9);
  });

  it('is null with no received income', () => {
    const month = normalizeMonth({
      totalBudget: 0,
      periodKey: '2026-09',
      incomeSources: [{ id: 's1', name: 'Salary', amount: 9000, status: 'planned' }],
    }, '2026-09');
    assert.equal(calculateSavingsRate(month), null);
  });
});
