import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CUSTOM_RATIOS,
  MonthBudget,
  SavingGoal,
  calculateEnvelopeAmounts,
  createNewMonth,
  normalizeCustomRatios,
  normalizeMonth,
  resolveMonthStrategy,
  resolveStrategy,
  saveGoalWithBalance,
  updateBudgetStrategy,
} from '../src/lib/store';

describe('Definable custom strategy', () => {
  it('normalizes fractions, percentages and garbage into a 100% split', () => {
    // Already-normalized fractions survive untouched
    assert.deepStrictEqual(normalizeCustomRatios({ needs: 0.5, wants: 0.3, savings: 0.2 }), {
      needs: 0.5,
      wants: 0.3,
      savings: 0.2,
    });

    // Whole percents are accepted and rescaled
    assert.deepStrictEqual(normalizeCustomRatios({ needs: 60, wants: 25, savings: 15 }), {
      needs: 0.6,
      wants: 0.25,
      savings: 0.15,
    });

    // Values that don't add up are rescaled proportionally
    const rescaled = normalizeCustomRatios({ needs: 40, wants: 40, savings: 40 });
    assert.ok(Math.abs(rescaled.needs + rescaled.wants + rescaled.savings - 1) < 1e-9);

    // Invalid input falls back to the default split
    assert.deepStrictEqual(normalizeCustomRatios(undefined), DEFAULT_CUSTOM_RATIOS);
    assert.deepStrictEqual(normalizeCustomRatios({ needs: NaN, wants: -5, savings: 0 }), DEFAULT_CUSTOM_RATIOS);
  });

  it('always produces three ratios that sum to exactly 1', () => {
    const awkward = [
      { needs: 33, wants: 33, savings: 34 },
      { needs: 1, wants: 1, savings: 1 },
      { needs: 70, wants: 29, savings: 1 },
      { needs: 100, wants: 0, savings: 0 },
    ];

    for (const input of awkward) {
      const r = normalizeCustomRatios(input);
      assert.strictEqual(Math.round((r.needs + r.wants + r.savings) * 100), 100);
    }
  });

  it('resolves the custom strategy from per-month ratios instead of a global', () => {
    const saver = resolveStrategy('custom', { needs: 0.4, wants: 0.1, savings: 0.5 });
    const spender = resolveStrategy('custom', { needs: 0.7, wants: 0.25, savings: 0.05 });

    assert.strictEqual(saver.savingsRatio, 0.5);
    assert.strictEqual(spender.savingsRatio, 0.05);
    // Resolving one must never mutate the shared STRATEGIES table
    assert.strictEqual(resolveStrategy('50-30-20').needsRatio, 0.5);
  });

  it('splits income by the custom ratios with no rounding leak', () => {
    const incomes = [1, 7, 4500, 12345, 1000001];
    const ratios = { needs: 0.45, wants: 0.15, savings: 0.4 };

    for (const income of incomes) {
      const { needs, wants, savings } = calculateEnvelopeAmounts(income, 'custom', ratios);
      assert.strictEqual(needs + wants + savings, income);
      assert.ok(needs >= 0 && wants >= 0 && savings >= 0);
    }

    const { needs, savings } = calculateEnvelopeAmounts(10000, 'custom', ratios);
    assert.strictEqual(needs, 4500);
    assert.strictEqual(savings, 4000);
  });

  it('persists the custom split on the month and recomputes the savings target', () => {
    const month = createNewMonth(10000, '50-30-20', ['Food'], [], '2026-07');
    assert.strictEqual(month.monthlySavingsTarget, 2000);

    const updated = updateBudgetStrategy(month, 'custom', { needs: 0.3, wants: 0.2, savings: 0.5 });
    assert.strictEqual(updated.strategyId, 'custom');
    assert.deepStrictEqual(updated.customRatios, { needs: 0.3, wants: 0.2, savings: 0.5 });
    assert.strictEqual(updated.monthlySavingsTarget, 5000);
    assert.strictEqual(resolveMonthStrategy(updated).savingsRatio, 0.5);

    // Re-applying custom without new ratios keeps the saved definition
    const reapplied = updateBudgetStrategy(updated, 'custom');
    assert.deepStrictEqual(reapplied.customRatios, { needs: 0.3, wants: 0.2, savings: 0.5 });

    // Switching to a preset keeps the definition around for later
    const preset = updateBudgetStrategy(updated, '70-20-10');
    assert.strictEqual(preset.strategyId, '70-20-10');
    assert.deepStrictEqual(preset.customRatios, { needs: 0.3, wants: 0.2, savings: 0.5 });
    assert.strictEqual(preset.monthlySavingsTarget, 1000);
  });

  it('round-trips the custom split through normalizeMonth (persistence)', () => {
    const created = createNewMonth(8000, 'custom', ['Food'], [], '2026-07', {
      needs: 0.25,
      wants: 0.25,
      savings: 0.5,
    });
    assert.deepStrictEqual(created.customRatios, { needs: 0.25, wants: 0.25, savings: 0.5 });
    assert.strictEqual(created.monthlySavingsTarget, 4000);

    // Simulate a Firestore read of the stored document
    const reloaded = normalizeMonth(JSON.parse(JSON.stringify(created)), '2026-07');
    assert.deepStrictEqual(reloaded.customRatios, created.customRatios);
    assert.strictEqual(resolveMonthStrategy(reloaded).savingsRatio, 0.5);

    // A legacy custom month with no stored ratios still resolves sanely
    const legacy = normalizeMonth({ totalBudget: 1000, strategyId: 'custom' }, '2026-07');
    assert.deepStrictEqual(legacy.customRatios, DEFAULT_CUSTOM_RATIOS);
  });

  it('leaves preset months free of a customRatios field', () => {
    const month = normalizeMonth({ totalBudget: 1000, strategyId: '50-30-20' }, '2026-07');
    assert.strictEqual(month.customRatios, undefined);
  });
});

describe('Savings goals with an existing balance', () => {
  const baseMonth = (): MonthBudget =>
    createNewMonth(10000, '50-30-20', ['Food'], [], '2026-07');

  const goal = (over: Partial<SavingGoal> = {}): SavingGoal => ({
    id: 'g1',
    name: 'Emergency Fund',
    target: 20000,
    current: 0,
    source: 'bank',
    active: true,
    ...over,
  });

  it('creates a goal with money already saved outside the tracked balances', () => {
    const month = baseMonth();
    const res = saveGoalWithBalance(month, [], goal({ current: 7500 }), null);

    assert.strictEqual(res.goals.length, 1);
    assert.strictEqual(res.goals[0].current, 7500);
    // No money place touched — the cash was never part of the tracked totals
    assert.strictEqual(res.month, month);
    assert.strictEqual(res.month.bankPart, month.bankPart);
  });

  it('moves the opening balance out of the chosen money place when asked', () => {
    const month = baseMonth();
    const res = saveGoalWithBalance(month, [], goal({ current: 2500 }), 'bank');

    assert.strictEqual(res.goals[0].current, 2500);
    assert.strictEqual(res.month.bankPart, month.bankPart - 2500);

    // Total wealth is conserved
    const wealth =
      res.month.bankPart +
      res.month.homePart +
      res.month.walletPart +
      res.goals.reduce((acc, g) => acc + g.current, 0);
    assert.strictEqual(wealth, month.bankPart + month.homePart + month.walletPart);
  });

  it('never lets a goal pull more than the money place holds', () => {
    const month = { ...baseMonth(), walletPart: 300 };
    const res = saveGoalWithBalance(month, [], goal({ current: 5000, source: 'wallet' }), 'wallet');

    assert.strictEqual(res.goals[0].current, 300);
    assert.strictEqual(res.month.walletPart, 0);
  });

  it('only transfers the difference when editing an existing balance', () => {
    const month = baseMonth();
    const first = saveGoalWithBalance(month, [], goal({ current: 1000 }), 'bank');
    const second = saveGoalWithBalance(
      first.month,
      first.goals,
      { ...first.goals[0], current: 1500 },
      'bank',
    );

    assert.strictEqual(second.goals.length, 1);
    assert.strictEqual(second.goals[0].current, 1500);
    assert.strictEqual(second.month.bankPart, month.bankPart - 1500);
  });

  it('returns money to the place when the balance is lowered', () => {
    const month = baseMonth();
    const funded = saveGoalWithBalance(month, [], goal({ current: 3000 }), 'bank');
    const lowered = saveGoalWithBalance(
      funded.month,
      funded.goals,
      { ...funded.goals[0], current: 1000 },
      'bank',
    );

    assert.strictEqual(lowered.goals[0].current, 1000);
    assert.strictEqual(lowered.month.bankPart, month.bankPart - 1000);
  });

  it('clamps negative or invalid opening balances to zero', () => {
    const month = baseMonth();
    const res = saveGoalWithBalance(month, [], goal({ current: -50 }), null);
    assert.strictEqual(res.goals[0].current, 0);
  });
});
