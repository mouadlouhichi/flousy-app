/**
 * Salary reset on a new period — the plan-dependent contract:
 *
 *   FREE : new period bank balance = full salary.
 *   PRO  : new period bank balance = full salary + remaining bank from the
 *          previous period (carried as an explicit "Carried over" income line).
 *
 * Also pins the safety properties: the carry-over line never propagates to
 * the period after next (non-recurring), never appears for empty/negative
 * remainders, and strategy envelopes stay based on the planned salary
 * (totalBudget), not inflated by leftovers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRolloverSeed,
  carryOverIncomeSources,
  carryOverRemainingBalance,
  normalizeMonth,
  CARRYOVER_INCOME_ID_PREFIX,
  CARRYOVER_INCOME_NAME,
  type MonthBudget,
  type VariableExpense,
} from '../src/lib/store';

/** A finished period: 8000 salary received, 5000 spent → 3000 left in bank. */
function previousMonth(extraExpenses: VariableExpense[] = []): MonthBudget {
  return normalizeMonth(
    {
      totalBudget: 8000,
      incomeSources: [
        {
          id: 'main-income',
          name: 'Primary Income',
          amount: 8000,
          status: 'paid',
          receivedAmount: 8000,
          recurring: true,
        },
        {
          id: 'bonus',
          name: 'One-off bonus',
          amount: 1000,
          status: 'paid',
          receivedAmount: 1000,
          recurring: false,
        },
      ],
      variableExpenses: [
        { id: 'v1', name: 'Groceries', amount: 6000, type: 'Food', date: '2026-08-05', place: 'bank' },
        ...extraExpenses,
      ],
    },
    '2026-08',
  );
}

describe('carryOverIncomeSources (salary reset in full)', () => {
  it('opens the new period with recurring income received at its full amount', () => {
    const carried = carryOverIncomeSources(previousMonth(), '2026-09');
    assert.equal(carried.length, 1, 'non-recurring bonus is not carried');
    const [salary] = carried;
    assert.equal(salary.amount, 8000);
    assert.equal(salary.status, 'paid');
    assert.equal(salary.receivedAmount, 8000, 'full salary is in the bank at period start');
    assert.ok(salary.receivedAt, 'receipt is timestamped');
    assert.equal(salary.id, 'income-occurrence-main-income-2026-09', 'deterministic id keeps retries idempotent');
  });

  it('resets a partially received salary back to the full template amount', () => {
    const prev = previousMonth();
    const [salarySource] = prev.incomeSources ?? [];
    assert.ok(salarySource);
    salarySource.status = 'partial';
    salarySource.receivedAmount = 2500;
    const [salary] = carryOverIncomeSources(prev, '2026-09');
    assert.equal(salary.receivedAmount, 8000, 'new period starts from the full salary, not the partial remainder');
  });
});

describe('carryOverRemainingBalance (Pro)', () => {
  it('turns the previous remaining bank balance into an explicit received income line', () => {
    const line = carryOverRemainingBalance(previousMonth(), '2026-09');
    assert.ok(line);
    // 8000 salary + 1000 bonus received − 6000 spent = 3000 left.
    assert.equal(line.amount, 3000);
    assert.equal(line.status, 'paid');
    assert.equal(line.receivedAmount, 3000);
    assert.equal(line.recurring, false, 'must not propagate to the period after next');
    assert.equal(line.name, CARRYOVER_INCOME_NAME);
    assert.ok(line.id.startsWith(CARRYOVER_INCOME_ID_PREFIX));
  });

  it('yields nothing when the previous period ended empty or overdrawn', () => {
    assert.equal(carryOverRemainingBalance({ bankPart: 0 }, '2026-09'), null);
    assert.equal(carryOverRemainingBalance({ bankPart: -250 }, '2026-09'), null);
  });
});

describe('buildRolloverSeed (the plan-dependent contract)', () => {
  it('FREE: new period bank balance equals the full salary', () => {
    const seed = buildRolloverSeed(previousMonth(), '2026-09', { carryRemainingBalance: false });
    const month = normalizeMonth(seed, '2026-09');
    assert.equal(month.bankPart, 8000, 'bank = full salary');
    assert.ok(
      !(month.incomeSources ?? []).some((s) => s.id.startsWith(CARRYOVER_INCOME_ID_PREFIX)),
      'no carry-over line on Free',
    );
  });

  it('PRO: new period bank balance equals full salary + previous remainder', () => {
    const seed = buildRolloverSeed(previousMonth(), '2026-09', { carryRemainingBalance: true });
    const month = normalizeMonth(seed, '2026-09');
    assert.equal(month.bankPart, 11000, 'bank = 8000 salary + 3000 carried over');
    const carry = (month.incomeSources ?? []).find((s) => s.id.startsWith(CARRYOVER_INCOME_ID_PREFIX));
    assert.ok(carry, 'carry-over is an explicit, auditable income line');
    assert.equal(carry.amount, 3000);
  });

  it('PRO with nothing left behaves exactly like Free', () => {
    // Previous period spent everything: 9000 received − 6000 − 3000 = 0 left.
    const prev = previousMonth([
      { id: 'v2', name: 'Rent', amount: 3000, type: 'Housing', date: '2026-08-10', place: 'bank' },
    ]);
    assert.equal(prev.bankPart, 0, 'sanity: previous period ended empty');
    const seed = buildRolloverSeed(prev, '2026-09', { carryRemainingBalance: true });
    const month = normalizeMonth(seed, '2026-09');
    assert.equal(month.bankPart, 8000);
    assert.ok(!(month.incomeSources ?? []).some((s) => s.id.startsWith(CARRYOVER_INCOME_ID_PREFIX)));
  });

  it('keeps strategy envelopes based on the planned salary, not the carried remainder', () => {
    const seed = buildRolloverSeed(previousMonth(), '2026-09', { carryRemainingBalance: true });
    assert.equal(seed.totalBudget, 8000, 'totalBudget stays the expected salary');
  });

  it('the carried line dies with its period: rolling over again re-derives from actual leftovers', () => {
    const seedSep = buildRolloverSeed(previousMonth(), '2026-09', { carryRemainingBalance: true });
    const september = normalizeMonth(seedSep, '2026-09');
    // Nothing spent in September: 8000 salary + 3000 carried = 11000 left.
    const seedOct = buildRolloverSeed(september, '2026-10', { carryRemainingBalance: true });
    const october = normalizeMonth(seedOct, '2026-10');
    const carrySources = (october.incomeSources ?? []).filter((s) => s.id.startsWith(CARRYOVER_INCOME_ID_PREFIX));
    assert.equal(carrySources.length, 1, 'exactly one fresh carry-over line, never a stacked copy');
    assert.equal(carrySources[0].amount, 11000, 'October carries September\u2019s actual remainder');
    assert.equal(october.bankPart, 8000 + 11000);
  });
});
