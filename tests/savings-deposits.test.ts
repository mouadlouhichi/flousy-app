import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MonthBudget,
  SavingGoal,
  createNewMonth,
  fundGoal,
  withdrawGoal,
  saveGoalWithBalance,
  normalizeMonth,
  calculateDepositedSavings,
} from '../src/lib/store';

describe('Savings deposits: plan tracking & recent activity', () => {
  const income = 10000;

  const newMonth = (): MonthBudget => createNewMonth(income, '50-30-20', [], [], '2026-08');

  const goal = (over: Partial<SavingGoal> = {}): SavingGoal => ({
    id: 'g1',
    name: 'Vacation Fund',
    target: 20000,
    current: 0,
    source: 'bank',
    active: true,
    ...over,
  });

  it('counts a Deposit (fund flow) as deposited savings and logs it', () => {
    const month = newMonth();
    const goals = [goal()];

    const res = fundGoal(month, goals, 'g1', 500, 'bank');

    // Only deposited money counts toward the home-screen savings plan
    assert.strictEqual(calculateDepositedSavings(res.goals), 500);
    assert.strictEqual(res.goals[0].deposited, 500);

    // The deposit shows up in recent activity
    assert.strictEqual(res.month.savingsActivity?.length, 1);
    const entry = res.month.savingsActivity![0];
    assert.strictEqual(entry.goalId, 'g1');
    assert.strictEqual(entry.goalName, 'Vacation Fund');
    assert.strictEqual(entry.type, 'deposit');
    assert.strictEqual(entry.amount, 500);
  });

  it('does NOT count bookkeeping "already saved" balances (checkbox unchecked)', () => {
    const month = newMonth();
    const bankBefore = month.bankPart;

    // Opening balance recorded without moving money out of a place
    const res = saveGoalWithBalance(month, [], goal({ current: 3000 }), null);

    assert.strictEqual(res.goals[0].current, 3000);
    assert.strictEqual(res.goals[0].deposited, 0);
    assert.strictEqual(calculateDepositedSavings(res.goals), 0);

    // No money moved, no activity logged
    assert.strictEqual(res.month.bankPart, bankBefore);
    assert.strictEqual(res.month.savingsActivity?.length ?? 0, 0);
  });

  it('counts a checkbox-checked opening balance as a real deposit and logs it', () => {
    const month = newMonth();
    const bankBefore = month.bankPart;

    const res = saveGoalWithBalance(month, [], goal({ current: 2500 }), 'bank');

    assert.strictEqual(res.goals[0].current, 2500);
    assert.strictEqual(res.goals[0].deposited, 2500);
    assert.strictEqual(res.month.bankPart, bankBefore - 2500);
    assert.strictEqual(res.month.savingsActivity?.[0].type, 'deposit');
    assert.strictEqual(res.month.savingsActivity?.[0].amount, 2500);
  });

  it('keeps bookkeeping balances out of the plan even when mixed with deposits', () => {
    const month = newMonth();

    // Start with a bookkeeping balance, then deposit on top of it
    const created = saveGoalWithBalance(month, [], goal({ current: 3000 }), null);
    const funded = fundGoal(created.month, created.goals, 'g1', 700, 'bank');

    assert.strictEqual(funded.goals[0].current, 3700);
    assert.strictEqual(funded.goals[0].deposited, 700);
    assert.strictEqual(calculateDepositedSavings(funded.goals), 700);
  });

  it('reduces deposited savings when money is withdrawn back to a place', () => {
    const month = newMonth();
    const funded = fundGoal(month, [goal()], 'g1', 500, 'bank');
    const withdrawn = withdrawGoal(funded.month, funded.goals, 'g1', 200, 'home');

    assert.strictEqual(withdrawn.goals[0].current, 300);
    assert.strictEqual(withdrawn.goals[0].deposited, 300);
    assert.strictEqual(calculateDepositedSavings(withdrawn.goals), 300);

    const entry = withdrawn.month.savingsActivity?.[0];
    assert.strictEqual(entry?.type, 'withdraw');
    assert.strictEqual(entry?.amount, 200);

    // Never goes negative
    const emptied = withdrawGoal(withdrawn.month, withdrawn.goals, 'g1', 9999, 'home');
    assert.strictEqual(emptied.goals[0].deposited, 0);
  });

  it('tracks deposits across checkbox-checked edits', () => {
    const month = newMonth();

    const created = saveGoalWithBalance(month, [], goal({ current: 1000 }), 'bank');
    assert.strictEqual(created.goals[0].deposited, 1000);

    // Increase with the checkbox checked -> additional deposit
    const increased = saveGoalWithBalance(
      created.month,
      created.goals,
      { ...created.goals[0], current: 1500 },
      'bank',
    );
    assert.strictEqual(increased.goals[0].deposited, 1500);

    // Lower the balance with the checkbox checked -> money returned
    const lowered = saveGoalWithBalance(
      increased.month,
      increased.goals,
      { ...increased.goals[0], current: 500 },
      'bank',
    );
    assert.strictEqual(lowered.goals[0].deposited, 500);
    assert.strictEqual(lowered.month.savingsActivity?.[0].type, 'withdraw');

    // Bookkeeping edit (no checkbox) keeps the deposit tracker untouched
    const edited = saveGoalWithBalance(
      lowered.month,
      lowered.goals,
      { ...lowered.goals[0], current: 400 },
      null,
    );
    assert.strictEqual(edited.goals[0].deposited, 400);
  });

  it('keeps the activity log through normalizeMonth and starts clean on a new month', () => {
    const month = newMonth();
    const funded = fundGoal(month, [goal()], 'g1', 500, 'bank');

    const normalized = normalizeMonth(JSON.parse(JSON.stringify(funded.month)));
    assert.strictEqual(normalized.savingsActivity?.length, 1);
    assert.strictEqual(normalized.savingsActivity?.[0].type, 'deposit');

    const nextMonth = createNewMonth(income, '50-30-20', [], [], '2026-09');
    assert.strictEqual(nextMonth.savingsActivity?.length ?? 0, 0);
  });

  it('drops invalid activity entries during normalization', () => {
    const raw = {
      totalBudget: income,
      savingsActivity: [
        { id: 'a', goalId: 'g1', goalName: 'A', type: 'deposit', amount: 100, date: '2026-08-01T00:00:00Z' },
        { goalId: 'g2', type: 'nonsense', amount: 50 },
        null,
      ],
    };

    const normalized = normalizeMonth(raw as any);
    assert.strictEqual(normalized.savingsActivity?.length, 1);
    assert.strictEqual(normalized.savingsActivity?.[0].id, 'a');
  });
});
