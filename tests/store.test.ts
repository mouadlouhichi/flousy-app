import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STRATEGIES,
  calculateEnvelopeAmounts,
  bucketOf,
  addVariableExpense,
  editVariableExpense,
  deleteVariableExpense,
  moveMoney,
  fundGoal,
  withdrawGoal,
  deleteFundedGoal,
  normalizeMonth,
  createNewMonth,
  calculateCategoryBudgets,
  StrategyId,
  SavingGoal,
  MonthBudget,
  VariableExpense,
  updateMoneyPlaces,
  calculateTotalIncome,
} from '../src/lib/store';

describe('Store & Money Math Invariants', () => {
  const strategies: StrategyId[] = ['50-30-20', 'zero-based', 'envelope', 'pay-first'];
  const testIncomes = [1, 7, 12345, 1000001, 4500];

  it('strategy ratios sum to exactly 1.0 (100%)', () => {
    strategies.forEach((stratId) => {
      const s = STRATEGIES[stratId];
      const sum = s.needsRatio + s.wantsRatio + s.savingsRatio;
      assert.ok(Math.abs(sum - 1.0) < 1e-5);
    });
  });

  it('envelope amounts sum to exactly the income with no rounding leak across all 4 strategies × 5 test incomes', () => {
    strategies.forEach((stratId) => {
      testIncomes.forEach((income) => {
        const { needs, wants, savings } = calculateEnvelopeAmounts(income, stratId);
        assert.strictEqual(needs + wants + savings, income);
        assert.ok(needs >= 0);
        assert.ok(wants >= 0);
        assert.ok(savings >= 0);
      });
    });
  });

  it('category bucket resolution works per-kind and falls back safely', () => {
    assert.strictEqual(bucketOf('Autre', 'variable'), 'wants');
    assert.strictEqual(bucketOf('Autre', 'fixed'), 'needs');

    assert.strictEqual(bucketOf('Groceries', 'variable'), 'needs');
    assert.strictEqual(bucketOf('Rent', 'fixed'), 'needs');
    assert.strictEqual(bucketOf('Netflix', 'fixed'), 'wants');
    assert.strictEqual(bucketOf('Dining Out', 'variable'), 'wants');
  });

  it('category budgets fill their envelope to the last currency unit without rounding leak', () => {
    const income = 12345;
    const categories = ['Groceries', 'Transport', 'Dining Out', 'Shopping'];
    const budgets = calculateCategoryBudgets(income, '50-30-20', categories, 'variable');

    const { needs, wants } = calculateEnvelopeAmounts(income, '50-30-20');

    const needsCatSum = budgets['Groceries'] + budgets['Transport'];
    const wantsCatSum = budgets['Dining Out'] + budgets['Shopping'];

    assert.strictEqual(needsCatSum, needs);
    assert.strictEqual(wantsCatSum, wants);
  });

  it('add -> edit -> delete expense returns to the exact starting balance', () => {
    let month: MonthBudget = createNewMonth(10000, '50-30-20', ['Groceries'], [], '2026-07');
    const startingBank = month.bankPart;

    const expense: VariableExpense = {
      id: 'e1',
      name: 'Supermarket',
      amount: 450,
      type: 'Groceries',
      date: '2026-07-26',
      place: 'bank',
    };

    // 1. Add
    month = addVariableExpense(month, expense);
    assert.strictEqual(month.bankPart, startingBank - 450);

    // 2. Edit amount and place
    const updatedExpense: VariableExpense = {
      ...expense,
      amount: 700,
      place: 'wallet',
    };
    // Give wallet some money first
    month.walletPart = 1000;
    month = editVariableExpense(month, expense, updatedExpense);

    assert.strictEqual(month.bankPart, startingBank); // refunded old bank
    assert.strictEqual(month.walletPart, 1000 - 700);

    // 3. Delete
    month = deleteVariableExpense(month, updatedExpense);
    assert.strictEqual(month.walletPart, 1000);
    assert.strictEqual(month.bankPart, startingBank);
  });

  it('move money debits source and credits destination strictly conserving total cash', () => {
    let month = createNewMonth(5000, '50-30-20', [], [], '2026-07');
    const totalCash = month.bankPart + month.homePart + month.walletPart;

    month = moveMoney(month, 'bank', 'home', 1200);
    assert.strictEqual(month.bankPart, 3800);
    assert.strictEqual(month.homePart, 1200);
    assert.strictEqual(month.bankPart + month.homePart + month.walletPart, totalCash);

    month = moveMoney(month, 'home', 'wallet', 500);
    assert.strictEqual(month.homePart, 700);
    assert.strictEqual(month.walletPart, 500);
    assert.strictEqual(month.bankPart + month.homePart + month.walletPart, totalCash);
  });

  it('fund -> withdraw -> delete goal conserves total cash', () => {
    let month = createNewMonth(10000, '50-30-20', [], [], '2026-07');
    const startingTotal = month.bankPart;

    let goals: SavingGoal[] = [
      { id: 'g1', name: 'Emergency Fund', target: 5000, current: 0, source: 'bank', active: true },
    ];

    // Fund
    const fundResult = fundGoal(month, goals, 'g1', 2000, 'bank');
    month = fundResult.month;
    goals = fundResult.goals;

    assert.strictEqual(month.bankPart, startingTotal - 2000);
    assert.strictEqual(goals[0].current, 2000);

    // Withdraw
    const withdrawResult = withdrawGoal(month, goals, 'g1', 500, 'bank');
    month = withdrawResult.month;
    goals = withdrawResult.goals;

    assert.strictEqual(month.bankPart, startingTotal - 1500);
    assert.strictEqual(goals[0].current, 1500);

    // Delete Goal (returns balance)
    const deleteResult = deleteFundedGoal(month, goals, 'g1');
    month = deleteResult.month;
    goals = deleteResult.goals;

    assert.strictEqual(month.bankPart, startingTotal);
    assert.strictEqual(goals.find((g) => g.id === 'g1'), undefined);
  });

  it('updateMoneyPlaces replaces the three wallet balances without changing the monthly budget', () => {
    const month = createNewMonth(10000, '50-30-20', ['Groceries'], [], '2026-07');

    const updated = updateMoneyPlaces(month, { bank: 2500, home: 600, wallet: 1200 });

    assert.strictEqual(updated.totalBudget, month.totalBudget);
    assert.strictEqual(updated.bankPart, 2500);
    assert.strictEqual(updated.homePart, 600);
    assert.strictEqual(updated.walletPart, 1200);
    assert.ok(updated.updatedAt);
  });

  it('normalizeMonth backfills missing properties for legacy docs', () => {
    const rawLegacy: Partial<MonthBudget> = {
      totalBudget: 4000,
      variableExpenses: [
        { id: 'legacy-1', name: 'Coffee', amount: 30, type: 'Food & Drink', date: '2026-07-01' } as any,
      ],
    };

    const normalized = normalizeMonth(rawLegacy, '2026-07');
    assert.strictEqual(normalized.strategyId, '50-30-20');
    assert.strictEqual(normalized.variableExpenses[0].place, 'bank');
    assert.ok(normalized.activeCategories.length > 0);
    assert.strictEqual(normalized.bankPart, 3970);
  });

  it('calculateTotalIncome never double counts the backfilled default income source', () => {
    // normalizeMonth backfills incomeSources with a default source equal to
    // totalBudget — summing both would report 2× the monthly budget.
    const normalized = normalizeMonth({ totalBudget: 10000 }, '2026-07');

    assert.strictEqual(normalized.incomeSources.length, 1);
    assert.strictEqual(normalized.incomeSources[0].amount, 10000);
    assert.strictEqual(calculateTotalIncome(normalized), 10000);
  });

  it('calculateTotalIncome sums declared sources and falls back to totalBudget', () => {
    // Multiple declared sources → their sum
    const withSources = normalizeMonth({
      totalBudget: 15000,
      incomeSources: [
        { id: 's1', name: 'Salary', amount: 12000 },
        { id: 's2', name: 'Freelance', amount: 3000 },
      ],
    }, '2026-07');
    assert.strictEqual(calculateTotalIncome(withSources), 15000);

    // Explicit empty sources array → falls back to totalBudget
    assert.strictEqual(calculateTotalIncome({ totalBudget: 8000, incomeSources: [] }), 8000);

    // Zeroed-out sources → falls back to totalBudget instead of reporting 0
    assert.strictEqual(
      calculateTotalIncome({ totalBudget: 5000, incomeSources: [{ id: 's1', name: 'Zero', amount: 0 }] }),
      5000
    );

    // Garbage amounts are ignored safely
    assert.strictEqual(
      calculateTotalIncome({ totalBudget: 0, incomeSources: [{ id: 's1', name: 'Bad', amount: NaN }] }),
      0
    );
  });
});
