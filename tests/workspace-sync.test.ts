import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMonth, type MonthBudget } from '../src/lib/store';
import { mergeSourceTransactionsIntoMonth, planWorkspaceSyncAlignment } from '../src/lib/workspace-sync';

function sourceMonth(): MonthBudget {
  return normalizeMonth({
    totalBudget: 6000,
    incomeSources: [{ id: 'income-1', name: 'Salary', amount: 6000, status: 'paid' }],
    variableExpenses: [
      { id: 'v-1', name: 'Groceries', amount: 120, type: 'Groceries', date: '2026-07-04', place: 'wallet' },
      { id: 'v-2', name: 'Bus', amount: 8, type: 'Transport', date: '2026-07-05', place: 'wallet' },
    ],
    fixedExpenses: [
      { id: 'f-1', name: 'Rent', amount: 900, type: 'Rent', date: '1st', place: 'bank', status: 'paid' },
    ],
    debts: [
      {
        id: 'd-1', name: 'Ali', amount: 300, type: 'debt', status: 'open', date: '2026-07-01',
        payments: [{ id: 'dp-1', amount: 100, date: '2026-07-02', place: 'bank' }],
      },
    ],
    transfers: [{ id: 't-1', from: 'bank', to: 'wallet', amount: 50, date: '2026-07-03T10:00:00.000Z' }],
    balanceAdjustments: [
      { id: 'adj-1', place: 'home', previousBalance: 300, newBalance: 250, delta: -50, reason: 'reconciliation', date: '2026-07-03T10:00:00.000Z' },
    ],
    savingsActivity: [
      { id: 's-1', goalId: 'g-1', goalName: 'Bike', type: 'deposit', amount: 100, date: '2026-07-03T10:00:00.000Z' },
    ],
  }, '2026-07');
}

function targetMonth(): MonthBudget {
  return normalizeMonth({
    totalBudget: 4000,
    incomeSources: [{ id: 'income-1', name: 'Salary', amount: 4000, status: 'paid' }],
    variableExpenses: [
      { id: 'v-1', name: 'Groceries (target edit)', amount: 150, type: 'Groceries', date: '2026-07-04', place: 'bank' },
      { id: 'v-9', name: 'Pharmacy', amount: 30, type: 'Health', date: '2026-07-06', place: 'bank' },
    ],
    fixedExpenses: [],
    debts: [],
    bankPart: 2000,
    homePart: 100,
    walletPart: 50,
  }, '2026-07');
}

describe('Workspace transaction sync (personal ⇄ household)', () => {
  it('appends only the records the target is missing, keeping original ids', () => {
    const merged = mergeSourceTransactionsIntoMonth(targetMonth(), sourceMonth());
    assert.ok(merged);
    assert.deepStrictEqual(merged.counts, {
      incomes: 0,          // income-1 already exists in the target
      variableExpenses: 1, // only v-2 is new (v-1 collides)
      fixedExpenses: 1,
      debts: 1,
    });
    const ids = merged.month.variableExpenses.map((e) => e.id);
    assert.ok(ids.includes('v-2'), 'new expense appended with its original id');
    assert.ok(ids.includes('v-9'), 'target-only record kept');
    assert.strictEqual(merged.month.fixedExpenses[0].id, 'f-1');
    assert.strictEqual(merged.month.debts?.[0].payments?.[0].id, 'dp-1');
  });

  it('lets the target win on id collisions (no overwrite, no duplicate)', () => {
    const merged = mergeSourceTransactionsIntoMonth(targetMonth(), sourceMonth());
    assert.ok(merged);
    const collision = merged.month.variableExpenses.find((e) => e.id === 'v-1');
    assert.strictEqual(collision?.name, 'Groceries (target edit)');
    assert.strictEqual(collision?.amount, 150);
    assert.strictEqual(merged.month.variableExpenses.filter((e) => e.id === 'v-1').length, 1);
    // The target's own income total stays authoritative when no income moved.
    assert.strictEqual(merged.month.totalBudget, 4000);
  });

  it('never touches balances, transfers, adjustments or savings activity', () => {
    const target = targetMonth();
    const merged = mergeSourceTransactionsIntoMonth(target, sourceMonth());
    assert.ok(merged);
    assert.strictEqual(merged.month.bankPart, target.bankPart);
    assert.strictEqual(merged.month.homePart, target.homePart);
    assert.strictEqual(merged.month.walletPart, target.walletPart);
    // t-1 / adj-1 / s-1 exist only in the source and must not be copied.
    assert.strictEqual(merged.month.transfers?.some((t) => t.id === 't-1'), false);
    assert.strictEqual(merged.month.balanceAdjustments?.some((a) => a.id === 'adj-1'), false);
    assert.strictEqual(merged.month.savingsActivity?.some((s) => s.id === 's-1'), false);
  });

  it('recomputes the declared budget when incomes are added', () => {
    const target = normalizeMonth({ totalBudget: 1000 }, '2026-07');
    const merged = mergeSourceTransactionsIntoMonth(target, sourceMonth());
    assert.ok(merged);
    assert.strictEqual(merged.counts.incomes, 1);
    // 1000 declared (default row) + the 6000 salary that was appended.
    assert.strictEqual(merged.month.totalBudget, 7000);
  });

  it('drops zero-amount source rows and returns null for empty source months', () => {
    const emptySource = normalizeMonth({ totalBudget: 0 }, '2026-07');
    assert.strictEqual(mergeSourceTransactionsIntoMonth(targetMonth(), emptySource), null);
  });

  it('returns null when the target already has everything', () => {
    const first = mergeSourceTransactionsIntoMonth(targetMonth(), sourceMonth());
    assert.ok(first);
    // Syncing the same source again (idempotent re-run) is a no-op.
    assert.strictEqual(mergeSourceTransactionsIntoMonth(first.month, sourceMonth()), null);
  });
});

describe('Budget-month start alignment (source point wins)', () => {
  it('reports aligned when both workspaces share a start day', () => {
    const plan = planWorkspaceSyncAlignment(1, 1, 'personal');
    assert.equal(plan.aligned, true);
    assert.equal(plan.day, 1);
    assert.equal(plan.target, undefined);
  });

  it('overrides the household from the personal source point', () => {
    const plan = planWorkspaceSyncAlignment(5, 1, 'personal');
    assert.equal(plan.aligned, false);
    assert.equal(plan.day, 5);
    assert.equal(plan.target, 'household');
  });

  it('overrides the personal workspace from the household source point', () => {
    const plan = planWorkspaceSyncAlignment(1, 15, 'household');
    assert.equal(plan.aligned, false);
    assert.equal(plan.day, 15);
    assert.equal(plan.target, 'personal');
  });

  it('defaults missing or out-of-range values to a valid day', () => {
    assert.deepEqual(planWorkspaceSyncAlignment(undefined, undefined, 'personal'), { aligned: true, day: 1 });
    const clamped = planWorkspaceSyncAlignment(40, 1, 'personal');
    assert.equal(clamped.day, 31);
    assert.equal(clamped.target, 'household');
    const zero = planWorkspaceSyncAlignment(0, 1, 'personal');
    assert.equal(zero.day, 1);
    assert.equal(zero.aligned, true);
  });
});
