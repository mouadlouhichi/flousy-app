export type Envelope = 'needs' | 'wants' | 'savings';
export type MoneyPlace = 'bank' | 'home' | 'wallet';
export type StrategyId = '50-30-20' | '70-20-10' | '80-20' | 'zero-based' | 'envelope' | 'pay-first' | 'custom';
export type ExpenseKind = 'variable' | 'fixed';

export interface Strategy {
  id: StrategyId;
  name: string;
  description: string;
  needsRatio: number;
  wantsRatio: number;
  savingsRatio: number;
}

/** User-defined allocation for the `custom` strategy (fractions of income). */
export interface CustomRatios {
  needs: number;
  wants: number;
  savings: number;
}

/** Fallback split used when a custom strategy has no (valid) ratios yet. */
export const DEFAULT_CUSTOM_RATIOS: CustomRatios = { needs: 0.5, wants: 0.3, savings: 0.2 };

export const STRATEGIES: Record<StrategyId, Strategy> = {
  '50-30-20': {
    id: '50-30-20',
    name: '50/30/20 Rule',
    description: 'Balanced approach splitting income into Needs (50%), Wants (30%), and Savings (20%).',
    needsRatio: 0.50,
    wantsRatio: 0.30,
    savingsRatio: 0.20,
  },
  '70-20-10': {
    id: '70-20-10',
    name: '70/20/10 Rule',
    description: 'Conservative approach: Needs (70%), Wants (20%), Savings (10%). Great for beginners.',
    needsRatio: 0.70,
    wantsRatio: 0.20,
    savingsRatio: 0.10,
  },
  '80-20': {
    id: '80-20',
    name: '80/20 Rule',
    description: 'Simple approach: Spend 80% on Needs & Wants, save 20%. Flexible and easy.',
    needsRatio: 0.50,
    wantsRatio: 0.30,
    savingsRatio: 0.20,
  },
  'zero-based': {
    id: 'zero-based',
    name: 'Zero-Based Budgeting',
    description: 'Give every unit a specific job: Needs (60%), Wants (25%), Savings (15%).',
    needsRatio: 0.60,
    wantsRatio: 0.25,
    savingsRatio: 0.15,
  },
  envelope: {
    id: 'envelope',
    name: 'Envelope System',
    description: 'Allocate specific amounts to categories: Needs (55%), Wants (35%), Savings (10%).',
    needsRatio: 0.55,
    wantsRatio: 0.35,
    savingsRatio: 0.10,
  },
  'pay-first': {
    id: 'pay-first',
    name: 'Pay-Yourself-First',
    description: 'Prioritize saving a specific amount first: Needs (45%), Wants (25%), Savings (30%).',
    needsRatio: 0.45,
    wantsRatio: 0.25,
    savingsRatio: 0.30,
  },
  custom: {
    id: 'custom',
    name: 'Custom Strategy',
    description: 'Define your own allocation ratios for Needs, Wants, and Savings.',
    needsRatio: DEFAULT_CUSTOM_RATIOS.needs,
    wantsRatio: DEFAULT_CUSTOM_RATIOS.wants,
    savingsRatio: DEFAULT_CUSTOM_RATIOS.savings,
  },
};

/**
 * Sanitize user-provided custom ratios.
 *
 * Accepts either fractions (0.5) or percentages (50) and always returns three
 * finite, non-negative fractions summing to exactly 1. Savings absorbs the
 * rounding remainder so the envelopes can never leak a unit of currency.
 */
export function normalizeCustomRatios(input?: Partial<CustomRatios> | null): CustomRatios {
  const raw = {
    needs: Number(input?.needs),
    wants: Number(input?.wants),
    savings: Number(input?.savings),
  };

  const safe = {
    needs: Number.isFinite(raw.needs) && raw.needs > 0 ? raw.needs : 0,
    wants: Number.isFinite(raw.wants) && raw.wants > 0 ? raw.wants : 0,
    savings: Number.isFinite(raw.savings) && raw.savings > 0 ? raw.savings : 0,
  };

  const total = safe.needs + safe.wants + safe.savings;
  if (total <= 0) return { ...DEFAULT_CUSTOM_RATIOS };

  // Work in whole percents so the UI (integer sliders) round-trips exactly.
  const needsPct = Math.round((safe.needs / total) * 100);
  const wantsPct = Math.round((safe.wants / total) * 100);
  const savingsPct = Math.max(0, 100 - needsPct - wantsPct);

  return {
    needs: needsPct / 100,
    wants: wantsPct / 100,
    savings: savingsPct / 100,
  };
}

/**
 * Resolve the effective strategy definition.
 *
 * For every preset this is just the static entry from `STRATEGIES`; for the
 * `custom` strategy the ratios come from the month document so each month (and
 * each user) keeps its own definable split instead of a shared global value.
 */
export function resolveStrategy(
  strategyId: StrategyId,
  customRatios?: Partial<CustomRatios> | null,
): Strategy {
  const base = STRATEGIES[strategyId] || STRATEGIES['50-30-20'];
  if (base.id !== 'custom') return base;

  const ratios = normalizeCustomRatios(customRatios);
  return {
    ...base,
    needsRatio: ratios.needs,
    wantsRatio: ratios.wants,
    savingsRatio: ratios.savings,
  };
}

/** Resolve the effective strategy of a month (honours its custom ratios). */
export function resolveMonthStrategy(
  month: Pick<MonthBudget, 'strategyId' | 'customRatios'>,
): Strategy {
  return resolveStrategy(month.strategyId, month.customRatios);
}

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  category?: string;
}

export interface VariableExpense {
  id: string;
  name: string;
  amount: number;
  type: string; // category name
  date: string; // YYYY-MM-DD
  place: MoneyPlace;
  note?: string;
  person?: string; // payer display-name snapshot (legacy-compatible)
  payerMemberId?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  tags?: string[];
  receiptUrl?: string;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  type: string; // category name
  date?: string; // due day e.g. "1st", "15th" or YYYY-MM-DD
  place: MoneyPlace;
  base?: number;
  person?: string; // payer display-name snapshot (legacy-compatible)
  payerMemberId?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  recurring?: boolean;
  receiptUrl?: string;
}

/** Default fixed-bill categories offered in the Add Fixed Charge modal. */
export const DEFAULT_FIXED_CATEGORIES = [
  'Rent',
  'Utilities',
  'Housing',
  'Subscriptions',
  'Insurance',
  'Internet',
  'Gym',
  'Other',
];

/** User-defined fixed-bill category stored on the profile. */
export interface FixedCategoryItem {
  name: string;
  color: string;
  icon: string;
}

export interface SavingGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  source: MoneyPlace;
  active: boolean;
  category?: string;
}

export type DebtType = 'debt' | 'credit';
export type DebtStatus = 'open' | 'settled';

export interface DebtItem {
  id: string;
  name: string;       // person/entity
  amount: number;
  type: DebtType;     // 'debt' = I owe, 'credit' = owed to me
  status: DebtStatus;
  date: string;       // YYYY-MM-DD
  note?: string;
}

export interface MonthBudget {
  totalBudget: number; // total income
  incomeSources?: IncomeSource[];
  bankPart: number;
  homePart: number;
  walletPart: number;
  strategyId: StrategyId;
  /** Allocation used when `strategyId === 'custom'` (fractions summing to 1). */
  customRatios?: CustomRatios;
  monthlySavingsTarget: number;
  variableExpenses: VariableExpense[];
  fixedExpenses: FixedExpense[];
  variableCategoryBases: Record<string, number>;
  fixedCategoryBases: Record<string, number>;
  categoryBudgets?: Record<string, number>; // Pro feature: planned maximum per category
  rolloverFromPrevious?: Record<string, number>; // Pro feature: amounts rolled over from previous month
  activeCategories: string[];
  categoryColors: Record<string, string>;
  categoryIcons: Record<string, string>;
  debts?: DebtItem[];
  updatedAt: string;
  updatedByUserId?: string;
}

export interface UserProfile {
  plan: 'free' | 'pro';
  currency: string;
  onboardingComplete: boolean;
  displayName?: string;
  theme?: 'light' | 'dark' | 'system';
  language?: 'en' | 'fr' | 'ar';
  householdMembers?: string[]; // legacy local person labels
  activeHouseholdId?: string;
  activeWorkspace?: 'personal' | 'household';
  householdIds?: string[];
  defaultCategoryBudgets?: Record<string, number>; // Pro feature: default budgets that persist across months
  enableRollover?: boolean; // Pro feature: carry unused budget to next month
  fixedCategories?: FixedCategoryItem[]; // user-defined fixed-bill categories
}

/**
 * Strategy Envelope Amounts Calculation
 * Needs + Wants + Savings MUST sum to exactly income with no rounding leak.
 * Savings envelope absorbs any rounding remainder.
 */
export function calculateEnvelopeAmounts(
  income: number,
  strategyId: StrategyId,
  customRatios?: Partial<CustomRatios> | null,
): { needs: number; wants: number; savings: number } {
  const safeIncome = Math.max(0, isNaN(income) || !isFinite(income) ? 0 : Math.round(income * 100) / 100);
  const strategy = resolveStrategy(strategyId, customRatios);

  const needs = Math.floor(safeIncome * strategy.needsRatio);
  const wants = Math.floor(safeIncome * strategy.wantsRatio);
  const savings = safeIncome - (needs + wants);

  return { needs, wants, savings };
}

/**
 * Update budget strategy and recalculate envelopes
 */
export function updateBudgetStrategy(
  month: MonthBudget,
  strategyId: StrategyId,
  customRatios?: Partial<CustomRatios> | null
): MonthBudget {
  // The custom split is persisted on the month document so it survives
  // reloads, syncs across devices and stays independent per month.
  const nextCustomRatios =
    strategyId === 'custom'
      ? normalizeCustomRatios(customRatios ?? month.customRatios)
      : month.customRatios;

  const { savings } = calculateEnvelopeAmounts(month.totalBudget, strategyId, nextCustomRatios);

  return {
    ...month,
    strategyId,
    ...(nextCustomRatios ? { customRatios: nextCustomRatios } : {}),
    monthlySavingsTarget: savings,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Effective Monthly Income Calculation
 * Prefers the sum of declared income sources; falls back to totalBudget.
 * NOTE: normalizeMonth backfills a default source equal to totalBudget, so the
 * two already agree — they must NEVER be added together (double counting).
 */
export function calculateTotalIncome(month: Pick<MonthBudget, 'totalBudget' | 'incomeSources'>): number {
  const sources = month.incomeSources || [];
  if (sources.length === 0) return month.totalBudget || 0;

  const sum = sources.reduce((acc, s) => acc + (typeof s?.amount === 'number' && isFinite(s.amount) ? s.amount : 0), 0);
  // If every source is zeroed out, keep the declared budget rather than showing 0.
  return sum > 0 ? sum : (month.totalBudget || 0);
}

/**
 * Category Bucket Resolution
 * Resolves whether a category is a 'needs' or 'wants' bucket depending on kind ('variable' vs 'fixed').
 */
export function bucketOf(categoryName: string, kind: ExpenseKind): Envelope {
  if (!categoryName) {
    return kind === 'fixed' ? 'needs' : 'wants';
  }

  const name = categoryName.trim().toLowerCase();

  const fixedWants = ['subscription', 'subscriptions', 'netflix', 'spotify', 'entertainment', 'leisure', 'gym', 'hobbies', 'loisirs'];
  const variableNeeds = ['groceries', 'food', 'food & drink', 'alimentation', 'health', 'santé', 'medical', 'pharmacy', 'transport', 'transportation', 'car', 'fuel', 'utilities', 'housing', 'rent'];

  if (kind === 'fixed') {
    if (fixedWants.some((w) => name.includes(w))) {
      return 'wants';
    }
    return 'needs';
  } else {
    if (variableNeeds.some((n) => name.includes(n))) {
      return 'needs';
    }
    return 'wants';
  }
}

/**
 * Calculates total spent by envelope in a given month.
 */
export function calculateEnvelopeSpent(month: MonthBudget): { needs: number; wants: number; savings: number; totalSpent: number } {
  let needs = 0;
  let wants = 0;

  for (const exp of month.variableExpenses || []) {
    const bucket = bucketOf(exp.type, 'variable');
    if (bucket === 'needs') needs += exp.amount;
    else if (bucket === 'wants') wants += exp.amount;
  }

  for (const exp of month.fixedExpenses || []) {
    const bucket = bucketOf(exp.type, 'fixed');
    if (bucket === 'needs') needs += exp.amount;
    else if (bucket === 'wants') wants += exp.amount;
  }

  const savings = month.monthlySavingsTarget || 0;
  const totalSpent = needs + wants;

  return { needs, wants, savings, totalSpent };
}

/**
 * Distribute envelope totals across active categories filling to the last unit.
 */
export function calculateCategoryBudgets(
  income: number,
  strategyId: StrategyId,
  categories: string[],
  kind: ExpenseKind = 'variable',
  customRatios?: Partial<CustomRatios> | null
): Record<string, number> {
  const { needs, wants } = calculateEnvelopeAmounts(income, strategyId, customRatios);
  const result: Record<string, number> = {};

  if (!categories || categories.length === 0) return result;

  const needsCats = categories.filter((c) => bucketOf(c, kind) === 'needs');
  const wantsCats = categories.filter((c) => bucketOf(c, kind) === 'wants');

  const distribute = (total: number, cats: string[]) => {
    if (cats.length === 0) return;
    const baseShare = Math.floor(total / cats.length);
    let remainder = total - baseShare * cats.length;

    cats.forEach((cat, idx) => {
      const extra = idx < remainder ? 1 : 0;
      result[cat] = baseShare + extra;
    });
  };

  distribute(needs, needsCats);
  distribute(wants, wantsCats);

  return result;
}

/**
 * Update category budget (Pro feature)
 */
export function updateCategoryBudget(
  month: MonthBudget,
  category: string,
  amount: number
): MonthBudget {
  const currentBudgets = month.categoryBudgets || {};
  const updatedBudgets = { ...currentBudgets };
  
  if (amount > 0) {
    updatedBudgets[category] = amount;
  } else {
    delete updatedBudgets[category];
  }
  
  return {
    ...month,
    categoryBudgets: updatedBudgets,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update default category budget in user profile (Pro feature)
 * These budgets persist across all months
 */
export function updateDefaultCategoryBudget(
  profile: UserProfile,
  category: string,
  amount: number
): UserProfile {
  const currentBudgets = profile.defaultCategoryBudgets || {};
  const updatedBudgets = { ...currentBudgets };
  
  if (amount > 0) {
    updatedBudgets[category] = amount;
  } else {
    delete updatedBudgets[category];
  }
  
  return {
    ...profile,
    defaultCategoryBudgets: updatedBudgets,
  };
}

/**
 * Add a custom fixed-bill category to the user profile.
 * No-op when a category with the same name (case-insensitive) already exists.
 */
export function addFixedCategory(profile: UserProfile, item: FixedCategoryItem): UserProfile {
  const existing = profile.fixedCategories || [];
  if (existing.some((c) => c.name.toLowerCase() === item.name.toLowerCase())) {
    return profile;
  }
  return { ...profile, fixedCategories: [...existing, item] };
}

/**
 * Update (rename / recolor / re-icon) an existing custom fixed-bill category.
 * Appends the item when no category matches `originalName`.
 */
export function updateFixedCategory(
  profile: UserProfile,
  originalName: string,
  item: FixedCategoryItem,
): UserProfile {
  const existing = profile.fixedCategories || [];
  const idx = existing.findIndex((c) => c.name === originalName);
  if (idx === -1) return addFixedCategory(profile, item);
  const next = [...existing];
  next[idx] = item;
  return { ...profile, fixedCategories: next };
}

/**
 * Retype fixed bills after a custom fixed category is renamed so existing
 * charges keep pointing at the updated category name.
 */
export function renameFixedCategory(
  month: MonthBudget,
  oldName: string,
  newName: string,
): MonthBudget {
  const trimmed = newName.trim();
  if (
    !trimmed ||
    trimmed === oldName ||
    !(month.fixedExpenses || []).some((b) => b.type === oldName)
  ) {
    return month;
  }
  return {
    ...month,
    fixedExpenses: month.fixedExpenses.map((b) =>
      b.type === oldName ? { ...b, type: trimmed } : b,
    ),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate rollover amounts from previous month (Pro feature)
 * Returns unused budget for each category that can carry forward
 */
export function calculateRolloverAmounts(
  previousMonth: MonthBudget
): Record<string, number> {
  const rollover: Record<string, number> = {};
  const categoryBudgets = previousMonth.categoryBudgets || {};
  
  Object.entries(categoryBudgets).forEach(([category, budget]) => {
    const spent = calculateCategorySpent(previousMonth, category);
    const remaining = Math.max(0, budget - spent);
    
    if (remaining > 0) {
      rollover[category] = remaining;
    }
  });
  
  return rollover;
}

/**
 * Calculate spent amount for a specific category.
 * Counts variable expenses only: category budgets govern variable spending,
 * so fixed bills (e.g. bills added during onboarding) must not inflate the
 * "spent" figure of a variable category budget. Fixed bills already count
 * towards the strategy envelopes via calculateEnvelopeSpent().
 */
export function calculateCategorySpent(
  month: MonthBudget,
  category: string
): number {
  return (month.variableExpenses || [])
    .filter((exp) => exp.type === category)
    .reduce((acc, exp) => acc + exp.amount, 0);
}

/**
 * Money Conservation operations on MonthBudget and SavingGoals
 */

export function addVariableExpense(month: MonthBudget, expense: VariableExpense): MonthBudget {
  const amount = Math.max(0, expense.amount);
  const updatedPlace = Math.max(0, (month[`${expense.place}Part`] || 0) - amount);

  return {
    ...month,
    [`${expense.place}Part`]: updatedPlace,
    variableExpenses: [expense, ...(month.variableExpenses || [])],
    updatedAt: new Date().toISOString(),
  };
}

export function editVariableExpense(month: MonthBudget, oldExpense: VariableExpense, newExpense: VariableExpense): MonthBudget {
  const updatedExpenses = (month.variableExpenses || []).map((exp) => (exp.id === oldExpense.id ? newExpense : exp));

  let bank = month.bankPart;
  let home = month.homePart;
  let wallet = month.walletPart;

  const places: Record<MoneyPlace, number> = { bank, home, wallet };

  // Refund old
  places[oldExpense.place] = (places[oldExpense.place] || 0) + oldExpense.amount;
  // Debit new
  places[newExpense.place] = Math.max(0, (places[newExpense.place] || 0) - newExpense.amount);

  return {
    ...month,
    bankPart: places.bank,
    homePart: places.home,
    walletPart: places.wallet,
    variableExpenses: updatedExpenses,
    updatedAt: new Date().toISOString(),
  };
}

export function deleteVariableExpense(month: MonthBudget, expense: VariableExpense): MonthBudget {
  const updatedExpenses = (month.variableExpenses || []).filter((exp) => exp.id !== expense.id);
  const restored = (month[`${expense.place}Part`] || 0) + expense.amount;

  return {
    ...month,
    [`${expense.place}Part`]: restored,
    variableExpenses: updatedExpenses,
    updatedAt: new Date().toISOString(),
  };
}

export function addFixedExpense(month: MonthBudget, expense: FixedExpense): MonthBudget {
  const amount = Math.max(0, expense.amount);
  const updatedPlace = Math.max(0, (month[`${expense.place}Part`] || 0) - amount);

  return {
    ...month,
    [`${expense.place}Part`]: updatedPlace,
    fixedExpenses: [expense, ...(month.fixedExpenses || [])],
    updatedAt: new Date().toISOString(),
  };
}

export function editFixedExpense(month: MonthBudget, oldExpense: FixedExpense, newExpense: FixedExpense): MonthBudget {
  const updatedExpenses = (month.fixedExpenses || []).map((exp) => (exp.id === oldExpense.id ? newExpense : exp));

  const places: Record<MoneyPlace, number> = { bank: month.bankPart, home: month.homePart, wallet: month.walletPart };
  places[oldExpense.place] = (places[oldExpense.place] || 0) + oldExpense.amount;
  places[newExpense.place] = Math.max(0, (places[newExpense.place] || 0) - newExpense.amount);

  return {
    ...month,
    bankPart: places.bank,
    homePart: places.home,
    walletPart: places.wallet,
    fixedExpenses: updatedExpenses,
    updatedAt: new Date().toISOString(),
  };
}

export function deleteFixedExpense(month: MonthBudget, expense: FixedExpense): MonthBudget {
  const updatedExpenses = (month.fixedExpenses || []).filter((exp) => exp.id !== expense.id);
  const restored = (month[`${expense.place}Part`] || 0) + expense.amount;

  return {
    ...month,
    [`${expense.place}Part`]: restored,
    fixedExpenses: updatedExpenses,
    updatedAt: new Date().toISOString(),
  };
}

export function moveMoney(month: MonthBudget, from: MoneyPlace, to: MoneyPlace, amount: number): MonthBudget {
  if (from === to || amount <= 0) return month;

  const currentFrom = month[`${from}Part`] || 0;
  const actualMove = Math.min(currentFrom, amount);

  return {
    ...month,
    [`${from}Part`]: currentFrom - actualMove,
    [`${to}Part`]: (month[`${to}Part`] || 0) + actualMove,
    updatedAt: new Date().toISOString(),
  };
}

export function updateMoneyPlaces(
  month: MonthBudget,
  values: Partial<Record<MoneyPlace, number>>
): MonthBudget {
  return {
    ...month,
    bankPart: Math.max(0, values.bank ?? month.bankPart ?? 0),
    homePart: Math.max(0, values.home ?? month.homePart ?? 0),
    walletPart: Math.max(0, values.wallet ?? month.walletPart ?? 0),
    updatedAt: new Date().toISOString(),
  };
}

export function fundGoal(
  month: MonthBudget,
  goals: SavingGoal[],
  goalId: string,
  amount: number,
  sourcePlace: MoneyPlace
): { month: MonthBudget; goals: SavingGoal[] } {
  if (amount <= 0) return { month, goals };

  const currentBalance = month[`${sourcePlace}Part`] || 0;
  const actualAmount = Math.min(currentBalance, amount);

  const updatedMonth = {
    ...month,
    [`${sourcePlace}Part`]: currentBalance - actualAmount,
    updatedAt: new Date().toISOString(),
  };

  const updatedGoals = goals.map((g) => {
    if (g.id === goalId) {
      return { ...g, current: g.current + actualAmount, source: sourcePlace };
    }
    return g;
  });

  return { month: updatedMonth, goals: updatedGoals };
}

export function withdrawGoal(
  month: MonthBudget,
  goals: SavingGoal[],
  goalId: string,
  amount: number,
  targetPlace: MoneyPlace
): { month: MonthBudget; goals: SavingGoal[] } {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || amount <= 0) return { month, goals };

  const actualWithdraw = Math.min(goal.current, amount);

  const updatedMonth = {
    ...month,
    [`${targetPlace}Part`]: (month[`${targetPlace}Part`] || 0) + actualWithdraw,
    updatedAt: new Date().toISOString(),
  };

  const updatedGoals = goals.map((g) => {
    if (g.id === goalId) {
      return { ...g, current: g.current - actualWithdraw };
    }
    return g;
  });

  return { month: updatedMonth, goals: updatedGoals };
}

/**
 * Create or update a savings goal while letting the user declare how much is
 * ALREADY saved for it (opening balance).
 *
 * New users typically start with money set aside before they ever open the
 * app, so a goal must be able to begin at a non-zero balance.
 *
 * `deductFromPlace`:
 *  - `undefined`/`null` → the balance is held outside the tracked bank / home /
 *    wallet cash, so no money place is touched (pure bookkeeping).
 *  - a money place → the difference is transferred out of (or back into) that
 *    place, exactly like funding/withdrawing, so total wealth is conserved.
 */
export function saveGoalWithBalance(
  month: MonthBudget,
  goals: SavingGoal[],
  goal: SavingGoal,
  deductFromPlace?: MoneyPlace | null,
): { month: MonthBudget; goals: SavingGoal[] } {
  const existing = goals.find((g) => g.id === goal.id);
  const previousCurrent = Math.max(0, existing?.current ?? 0);
  const requested = Math.max(0, Number.isFinite(goal.current) ? goal.current : 0);

  let nextCurrent = requested;
  let nextMonth = month;

  if (deductFromPlace) {
    const balance = month[`${deductFromPlace}Part`] || 0;
    const delta = requested - previousCurrent;

    if (delta > 0) {
      // Never let a goal pull more than what actually sits in that place.
      const actual = Math.min(balance, delta);
      nextCurrent = previousCurrent + actual;
      nextMonth = {
        ...month,
        [`${deductFromPlace}Part`]: balance - actual,
        updatedAt: new Date().toISOString(),
      };
    } else if (delta < 0) {
      nextMonth = {
        ...month,
        [`${deductFromPlace}Part`]: balance + -delta,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  const nextGoal: SavingGoal = { ...goal, current: nextCurrent };
  const goalsWithout = goals.filter((g) => g.id !== goal.id);
  const nextGoals = existing
    ? goals.map((g) => (g.id === goal.id ? nextGoal : g))
    : [...goalsWithout, nextGoal];

  return { month: nextMonth, goals: nextGoals };
}

export function deleteFundedGoal(
  month: MonthBudget,
  goals: SavingGoal[],
  goalId: string
): { month: MonthBudget; goals: SavingGoal[] } {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return { month, goals: goals.filter((g) => g.id !== goalId) };

  const returnPlace = goal.source || 'bank';
  const updatedMonth = {
    ...month,
    [`${returnPlace}Part`]: (month[`${returnPlace}Part`] || 0) + goal.current,
    updatedAt: new Date().toISOString(),
  };

  const updatedGoals = goals.filter((g) => g.id !== goalId);

  return { month: updatedMonth, goals: updatedGoals };
}

/**
 * Debts CRUD
 */
export function addDebt(month: MonthBudget, debt: DebtItem): MonthBudget {
  return {
    ...month,
    debts: [debt, ...(month.debts || [])],
    updatedAt: new Date().toISOString(),
  };
}

export function editDebt(month: MonthBudget, oldId: string, newDebt: DebtItem): MonthBudget {
  return {
    ...month,
    debts: (month.debts || []).map((d) => (d.id === oldId ? newDebt : d)),
    updatedAt: new Date().toISOString(),
  };
}

export function deleteDebt(month: MonthBudget, debtId: string): MonthBudget {
  return {
    ...month,
    debts: (month.debts || []).filter((d) => d.id !== debtId),
    updatedAt: new Date().toISOString(),
  };
}

export function toggleDebtStatus(month: MonthBudget, debtId: string): MonthBudget {
  return {
    ...month,
    debts: (month.debts || []).map((d) =>
      d.id === debtId ? { ...d, status: d.status === 'open' ? 'settled' : 'open' } : d
    ),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Normalizes a raw Firestore month document, backfilling missing or legacy properties.
 * Handles rollover from previous month for Pro users.
 */
export function normalizeMonth(
  raw: Partial<MonthBudget> | null | undefined, 
  monthKey?: string,
  userProfile?: UserProfile,
  previousMonth?: MonthBudget
): MonthBudget {
  const fallbackIncome = raw?.totalBudget ?? 0;
  const strategyId: StrategyId = raw?.strategyId || '50-30-20';
  // Persisted per-month custom split; only meaningful for the custom strategy
  // but kept around so switching back and forth doesn't lose the definition.
  const customRatios =
    raw?.customRatios || strategyId === 'custom'
      ? normalizeCustomRatios(raw?.customRatios)
      : undefined;
  const defaultEnvelopes = calculateEnvelopeAmounts(fallbackIncome, strategyId, customRatios);

  const defaultCategories = [
    'Groceries',
    'Transport',
    'Rent',
    'Entertainment',
    'Health',
    'Utilities',
    'Dining Out',
    'Shopping',
    'Subscriptions',
  ];

  const defaultColors: Record<string, string> = {
    Groceries: '#f97316',
    Transport: '#3b82f6',
    Rent: '#8b5cf6',
    Entertainment: '#ec4899',
    Health: '#10b981',
    Utilities: '#eab308',
    'Dining Out': '#ef4444',
    Shopping: '#06b6d4',
    Subscriptions: '#6366f1',
  };

  const defaultIcons: Record<string, string> = {
    Groceries: 'restaurant',
    Transport: 'directions_car',
    Rent: 'home',
    Entertainment: 'sports_esports',
    Health: 'favorite',
    Utilities: 'bolt',
    'Dining Out': 'local_dining',
    Shopping: 'shopping_bag',
    Subscriptions: 'movie',
  };

  const totalBudget = typeof raw?.totalBudget === 'number' && !isNaN(raw.totalBudget) ? raw.totalBudget : 0;

  const incomeSources: IncomeSource[] =
    raw?.incomeSources && raw.incomeSources.length > 0
      ? raw.incomeSources
      : [{ id: 'main-income', name: 'Primary Income', amount: totalBudget }];

  // Normalize expenses: ensure 'place' exists (default to 'bank')
  const variableExpenses: VariableExpense[] = (raw?.variableExpenses || []).map((exp) => ({
    id: exp.id || Math.random().toString(36).substring(2, 9),
    name: exp.name || 'Expense',
    amount: typeof exp.amount === 'number' ? exp.amount : 0,
    type: exp.type || 'Other',
    date: exp.date || new Date().toISOString().split('T')[0],
    place: exp.place || 'bank',
    note: exp.note,
    person: exp.person || 'Self',
    tags: exp.tags || [],
    receiptUrl: exp.receiptUrl,
  }));

  const fixedExpenses: FixedExpense[] = (raw?.fixedExpenses || []).map((exp) => ({
    id: exp.id || Math.random().toString(36).substring(2, 9),
    name: exp.name || 'Fixed Bill',
    amount: typeof exp.amount === 'number' ? exp.amount : 0,
    type: exp.type || 'Utilities',
    date: exp.date || '1st',
    place: exp.place || 'bank',
    base: exp.base,
    person: exp.person || 'Self',
    recurring: exp.recurring ?? true,
    receiptUrl: exp.receiptUrl,
  }));

  // Calculate sum of variable/fixed expenses paid per place if places weren't explicitly provided
  const variableSpent = variableExpenses.reduce((acc, e) => acc + e.amount, 0);
  const fixedSpent = fixedExpenses.reduce((acc, e) => acc + e.amount, 0);

  const bankPart =
    typeof raw?.bankPart === 'number'
      ? raw.bankPart
      : Math.max(0, totalBudget - variableSpent - fixedSpent);
  const homePart = typeof raw?.homePart === 'number' ? raw.homePart : 0;
  const walletPart = typeof raw?.walletPart === 'number' ? raw.walletPart : 0;

  // Copy default category budgets from user profile if month doesn't have any set
  let categoryBudgets = raw?.categoryBudgets && Object.keys(raw.categoryBudgets).length > 0
    ? raw.categoryBudgets
    : (userProfile?.defaultCategoryBudgets || {});

  // Apply rollover from previous month (Pro feature)
  let rolloverFromPrevious: Record<string, number> | undefined;
  if (userProfile?.enableRollover && previousMonth && !raw?.rolloverFromPrevious) {
    rolloverFromPrevious = calculateRolloverAmounts(previousMonth);
    
    // Add rollover amounts to category budgets
    categoryBudgets = { ...categoryBudgets };
    Object.entries(rolloverFromPrevious).forEach(([category, amount]) => {
      categoryBudgets[category] = (categoryBudgets[category] || 0) + amount;
    });
  } else {
    rolloverFromPrevious = raw?.rolloverFromPrevious;
  }

  return {
    totalBudget,
    incomeSources,
    bankPart,
    homePart,
    walletPart,
    strategyId,
    ...(customRatios ? { customRatios } : {}),
    monthlySavingsTarget: raw?.monthlySavingsTarget ?? defaultEnvelopes.savings,
    variableExpenses,
    fixedExpenses,
    variableCategoryBases: raw?.variableCategoryBases || {},
    fixedCategoryBases: raw?.fixedCategoryBases || {},
    categoryBudgets,
    rolloverFromPrevious,
    activeCategories: raw?.activeCategories || defaultCategories,
    categoryColors: { ...defaultColors, ...(raw?.categoryColors || {}) },
    categoryIcons: { ...defaultIcons, ...(raw?.categoryIcons || {}) },
    debts: (raw?.debts || []).map((d) => ({
      id: d.id || Math.random().toString(36).substring(2, 9),
      name: d.name || 'Unknown',
      amount: typeof d.amount === 'number' ? d.amount : 0,
      type: d.type || 'debt',
      status: d.status || 'open',
      date: d.date || new Date().toISOString().split('T')[0],
      note: d.note,
    })),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

/**
 * Carries over recurring fixed expenses from a previous month into a new month.
 * Only copies bills with `recurring: true`.
 */
export function carryOverFixedExpenses(
  newMonth: MonthBudget,
  previousMonth: MonthBudget,
): MonthBudget {
  const recurringBills = (previousMonth.fixedExpenses || []).filter((b) => b.recurring !== false);
  if (recurringBills.length === 0) return newMonth;

  const existingIds = new Set((newMonth.fixedExpenses || []).map((b) => b.id));
  const toCarry = recurringBills.filter((b) => !existingIds.has(b.id));

  // Recreate IDs so they don't collide
  const carried = toCarry.map((b) => ({
    ...b,
    id: `carry-${b.id}-${Date.now()}`,
    date: b.date || '1st',
  }));

  const totalCarried = carried.reduce((acc, b) => acc + b.amount, 0);
  const totalExistingFixed = (newMonth.fixedExpenses || []).reduce((acc, b) => acc + b.amount, 0);

  return {
    ...newMonth,
    fixedExpenses: [...(newMonth.fixedExpenses || []), ...carried],
    bankPart: Math.max(0, (newMonth.bankPart || 0) - totalCarried),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates a brand new MonthBudget initialized with defaults
 */
export function createNewMonth(
  income: number,
  strategyId: StrategyId,
  categories: string[],
  bills: { name: string; amount: number; category: string }[],
  monthKey: string,
  customRatios?: Partial<CustomRatios> | null
): MonthBudget {
  const resolvedCustomRatios =
    strategyId === 'custom' ? normalizeCustomRatios(customRatios) : undefined;
  const { savings } = calculateEnvelopeAmounts(income, strategyId, resolvedCustomRatios);

  const fixedExpenses: FixedExpense[] = bills.map((b, idx) => ({
    id: `fixed-${idx}-${Date.now()}`,
    name: b.name,
    amount: b.amount,
    type: b.category,
    date: '1st',
    place: 'bank',
  }));

  const totalFixed = fixedExpenses.reduce((acc, b) => acc + b.amount, 0);
  const remainingBank = Math.max(0, income - totalFixed);

  return normalizeMonth({
    totalBudget: income,
    bankPart: remainingBank,
    homePart: 0,
    walletPart: 0,
    strategyId,
    ...(resolvedCustomRatios ? { customRatios: resolvedCustomRatios } : {}),
    monthlySavingsTarget: savings,
    fixedExpenses,
    variableExpenses: [],
    activeCategories: categories.length > 0 ? categories : undefined,
  }, monthKey);
}
