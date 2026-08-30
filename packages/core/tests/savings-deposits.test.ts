import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MonthBudget,
  SavingGoal,
  createNewMonth,
  moveMoney,
  fundGoal,
  withdrawGoal,
  saveGoalWithBalance,
  deleteFundedGoal,
  updateSavingsActivityEntry,
  deleteSavingsActivityEntry,
  normalizeMonth,
  calculateDepositedSavings,
  calculateMonthlyDepositedSavings,
  calculateMonthlySavingsFlow,
} from '../src/store';

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

  it('counts only THIS month\'s deposits in the savings plan (lifetime balances do not leak)', () => {
    // July: one 400 deposit.
    const july = newMonth();
    const julyFunded = fundGoal(july, [goal()], 'g1', 400, 'bank');

    // August: a fresh budget month, one more 400 deposit.
    const august = createNewMonth(income, '50-30-20', [], [], '2026-09');
    const augustFunded = fundGoal(august, julyFunded.goals, 'g1', 400, 'bank');

    // The goal remembers 800 saved over its lifetime...
    assert.strictEqual(augustFunded.goals[0].current, 800);
    assert.strictEqual(calculateDepositedSavings(augustFunded.goals), 800);

    // ...but the August plan only shows the 400 moved during August.
    assert.strictEqual(calculateMonthlyDepositedSavings(augustFunded.month), 400);
    assert.strictEqual(augustFunded.month.savingsActivity?.length, 1);
  });

  it('ignores an opening balance moved in a previous month when planning the current month', () => {
    // Goal opened in July with 400 taken out of the bank (checkbox checked).
    const july = newMonth();
    const opened = saveGoalWithBalance(july, [], goal({ current: 400 }), 'bank');
    assert.strictEqual(calculateMonthlyDepositedSavings(opened.month), 400);

    const august = createNewMonth(income, '50-30-20', [], [], '2026-09');
    const funded = fundGoal(august, opened.goals, 'g1', 400, 'bank');

    assert.strictEqual(calculateMonthlyDepositedSavings(funded.month), 400);
  });

  it('edits a logged deposit: amount, place and goal follow the money', () => {
    const month = newMonth();
    const goals = [goal(), goal({ id: 'g2', name: 'Emergency Fund' })];
    const funded = fundGoal(month, goals, 'g1', 400, 'bank');
    // Park 250 in the wallet so the corrected entry has cash to draw from.
    const withWallet = moveMoney(funded.month, 'bank', 'wallet', 250);
    const bankAfterMove = withWallet.bankPart;
    const entryId = withWallet.savingsActivity![0].id;

    // Correct the deposit: it was actually 250 taken from the wallet.
    const edited = updateSavingsActivityEntry(withWallet, funded.goals, entryId, {
      amount: 250,
      place: 'wallet',
    });

    assert.strictEqual(edited.month.walletPart, 0); // 250 - 250
    assert.strictEqual(edited.month.bankPart, bankAfterMove + 400); // old movement undone
    assert.strictEqual(edited.goals.find((g) => g.id === 'g1')!.current, 250);
    assert.strictEqual(edited.goals.find((g) => g.id === 'g1')!.deposited, 250);
    assert.strictEqual(calculateMonthlyDepositedSavings(edited.month), 250);
    assert.strictEqual(edited.month.savingsActivity![0].place, 'wallet');

    // Move the deposit onto another goal — the money follows it.
    const moved = updateSavingsActivityEntry(edited.month, edited.goals, entryId, { goalId: 'g2' });
    assert.strictEqual(moved.goals.find((g) => g.id === 'g1')!.current, 0);
    assert.strictEqual(moved.goals.find((g) => g.id === 'g2')!.current, 250);
    assert.strictEqual(moved.month.savingsActivity![0].goalName, 'Emergency Fund');
    assert.strictEqual(calculateMonthlyDepositedSavings(moved.month), 250);
  });

  it('never moves more cash than the money place / goal actually holds', () => {
    const month = newMonth();
    const funded = fundGoal(month, [goal()], 'g1', 400, 'bank');
    const entryId = funded.month.savingsActivity![0].id;

    // The wallet is empty, so nothing can be pulled out of it.
    const edited = updateSavingsActivityEntry(funded.month, funded.goals, entryId, { place: 'wallet' });

    assert.strictEqual(edited.month.walletPart, 0);
    assert.strictEqual(edited.goals[0].current, 0);
    assert.strictEqual(calculateMonthlyDepositedSavings(edited.month), 0);
    // Wealth is conserved: the bank got its 400 back.
    assert.strictEqual(edited.month.bankPart, month.bankPart);
  });

  it('editing a deposit into a withdrawal reverses the money movement', () => {
    const month = newMonth();
    // 1,000 already saved (bookkeeping) + a 400 deposit made this month.
    const started = saveGoalWithBalance(month, [], goal({ current: 1000 }), null);
    const funded = fundGoal(started.month, started.goals, 'g1', 400, 'bank');
    const entryId = funded.month.savingsActivity![0].id;

    const flipped = updateSavingsActivityEntry(funded.month, funded.goals, entryId, {
      type: 'withdraw',
      amount: 400,
    });

    // The 400 deposit is undone and the withdrawal pays 400 back to the bank
    // (the goal's 1,000 opening balance was bookkeeping, never tracked cash).
    assert.strictEqual(flipped.month.bankPart, month.bankPart + 400);
    assert.strictEqual(flipped.goals[0].current, 600);
    assert.strictEqual(flipped.goals[0].deposited, 0);
    assert.strictEqual(calculateMonthlyDepositedSavings(flipped.month), 0);
    assert.strictEqual(calculateMonthlySavingsFlow(flipped.month).withdrawals, 400);
  });

  it('deletes a deposit and puts the money back where it came from', () => {
    const month = newMonth();
    const bankBefore = month.bankPart;
    const funded = fundGoal(month, [goal()], 'g1', 400, 'bank');
    const entryId = funded.month.savingsActivity![0].id;

    const removed = deleteSavingsActivityEntry(funded.month, funded.goals, entryId);

    assert.strictEqual(removed.month.bankPart, bankBefore);
    assert.strictEqual(removed.goals[0].current, 0);
    assert.strictEqual(removed.goals[0].deposited, 0);
    assert.strictEqual(removed.month.savingsActivity?.length ?? 0, 0);
    assert.strictEqual(calculateMonthlyDepositedSavings(removed.month), 0);
  });

  it('deletes a withdrawal and pulls the money back out of the money place', () => {
    const month = newMonth();
    const started = saveGoalWithBalance(month, [], goal({ current: 1000 }), null);
    const withdrawn = withdrawGoal(started.month, started.goals, 'g1', 300, 'home');
    assert.strictEqual(withdrawn.month.homePart, 300);

    const entryId = withdrawn.month.savingsActivity![0].id;
    const removed = deleteSavingsActivityEntry(withdrawn.month, withdrawn.goals, entryId);

    assert.strictEqual(removed.month.homePart, 0);
    assert.strictEqual(removed.goals[0].current, 1000);
    assert.strictEqual(removed.month.savingsActivity?.length ?? 0, 0);
    assert.strictEqual(calculateMonthlyDepositedSavings(removed.month), 0);
  });

  it('keeps the plan in sync when a funded goal is deleted', () => {
    const month = newMonth();
    const funded = fundGoal(month, [goal()], 'g1', 400, 'bank');
    assert.strictEqual(calculateMonthlyDepositedSavings(funded.month), 400);

    const deleted = deleteFundedGoal(funded.month, funded.goals, 'g1');
    assert.strictEqual(calculateMonthlyDepositedSavings(deleted.month), 0);
    assert.strictEqual(deleted.month.savingsActivity?.length ?? 0, 0);
  });

  it('remembers the money place of each entry through normalizeMonth', () => {
    const month = newMonth();
    const funded = fundGoal(month, [goal()], 'g1', 400, 'bank');
    const entryId = funded.month.savingsActivity![0].id;

    const normalized = normalizeMonth(JSON.parse(JSON.stringify(funded.month)));
    assert.strictEqual(normalized.savingsActivity![0].place, 'bank');

    // An edited entry keeps its place after a round-trip through storage
    // (fund the home place first so the edit has cash to move).
    const withHome = moveMoney(funded.month, 'bank', 'home', 400);
    const edited = updateSavingsActivityEntry(withHome, funded.goals, entryId, { place: 'home' });
    assert.strictEqual(edited.month.savingsActivity![0].place, 'home');

    const renorm = normalizeMonth(JSON.parse(JSON.stringify(edited.month)));
    assert.strictEqual(renorm.savingsActivity![0].place, 'home');
  });
});
