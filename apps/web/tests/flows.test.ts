import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewMonth,
  addVariableExpense,
  moveMoney,
  fundGoal,
  withdrawGoal,
  deleteVariableExpense,
  deleteFundedGoal,
  SavingGoal,
  MonthBudget,
} from '../src/lib/store';

describe('End-to-End User Journeys & Total Cash Conservation', () => {
  it('conserves total liquid cash + allocated goal funds across a complete monthly workflow', () => {
    // 1. Initial Onboarding Month Creation: Income = 15,000 MAD
    const income = 15000;
    let month: MonthBudget = createNewMonth(
      income,
      '50-30-20',
      ['Groceries', 'Transport', 'Rent', 'Subscriptions'],
      [{ name: 'Rent', amount: 3500, category: 'Rent' }],
      '2026-07'
    );

    // Initial check: Bank has 15000 - 3500 (fixed) = 11500
    assert.strictEqual(month.bankPart, 11500);
    assert.strictEqual(month.homePart, 0);
    assert.strictEqual(month.walletPart, 0);

    let goals: SavingGoal[] = [
      { id: 'goal-vacation', name: 'Vacation', target: 5000, current: 0, source: 'bank', active: true },
    ];

    // Total starting wealth tracked across accounts and goal balances
    const getOverallWealth = () =>
      month.bankPart +
      month.homePart +
      month.walletPart +
      goals.reduce((acc, g) => acc + g.current, 0) +
      month.fixedExpenses.reduce((acc, f) => acc + f.amount, 0) +
      month.variableExpenses.reduce((acc, v) => acc + v.amount, 0);

    assert.strictEqual(getOverallWealth(), income);

    // 2. User moves 2,000 to Home Cash, 1,000 to Wallet
    month = moveMoney(month, 'bank', 'home', 2000);
    month = moveMoney(month, 'bank', 'wallet', 1000);

    assert.strictEqual(getOverallWealth(), income);
    assert.strictEqual(month.bankPart, 8500);
    assert.strictEqual(month.homePart, 2000);
    assert.strictEqual(month.walletPart, 1000);

    // 3. User buys groceries for 450 MAD from Wallet
    const groceriesExpense = {
      id: 'v-1',
      name: 'Marjane Supermarket',
      amount: 450,
      type: 'Groceries',
      date: '2026-07-26',
      place: 'wallet' as const,
    };
    month = addVariableExpense(month, groceriesExpense);
    assert.strictEqual(month.walletPart, 550);
    assert.strictEqual(getOverallWealth(), income);

    // 4. User funds Vacation Goal with 1,500 MAD from Bank
    const fundRes = fundGoal(month, goals, 'goal-vacation', 1500, 'bank');
    month = fundRes.month;
    goals = fundRes.goals;

    assert.strictEqual(month.bankPart, 7000);
    assert.strictEqual(goals[0].current, 1500);
    assert.strictEqual(getOverallWealth(), income);

    // 5. User withdraws 300 MAD from Vacation Goal back to Home Cash
    const withdrawRes = withdrawGoal(month, goals, 'goal-vacation', 300, 'home');
    month = withdrawRes.month;
    goals = withdrawRes.goals;

    assert.strictEqual(month.homePart, 2300);
    assert.strictEqual(goals[0].current, 1200);
    assert.strictEqual(getOverallWealth(), income);

    // 6. User refunds groceries expense
    month = deleteVariableExpense(month, groceriesExpense);
    assert.strictEqual(month.walletPart, 1000);
    assert.strictEqual(getOverallWealth(), income);

    // 7. User deletes Vacation goal (returns balance to bank)
    const deleteGoalRes = deleteFundedGoal(month, goals, 'goal-vacation');
    month = deleteGoalRes.month;
    goals = deleteGoalRes.goals;

    assert.strictEqual(month.bankPart, 8200); // 7000 + 1200
    assert.strictEqual(getOverallWealth(), income);
  });
});
