export type Envelope = 'needs' | 'wants' | 'savings';
export type MoneyPlace = 'bank' | 'home' | 'wallet';
export type StrategyId = '50-30-20' | 'zero-based' | 'envelope' | 'pay-first';
export type ExpenseKind = 'variable' | 'fixed';

export interface Strategy {
  id: StrategyId;
  name: string;
  description: string;
  needsRatio: number;
  wantsRatio: number;
  savingsRatio: number;
}

export const STRATEGIES: Record<StrategyId, Strategy> = {
  '50-30-20': {
    id: '50-30-20',
    name: '50/30/20 Rule',
    description: 'Balanced approach splitting income into Needs (50%), Wants (30%), and Savings (20%).',
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
};

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
  person?: string;
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
  person?: string;
  recurring?: boolean;
  receiptUrl?: string;
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

export interface MonthBudget {
  totalBudget: number; // total income
  incomeSources?: IncomeSource[];
  bankPart: number;
  homePart: number;
  walletPart: number;
  strategyId: StrategyId;
  monthlySavingsTarget: number;
  variableExpenses: VariableExpense[];
  fixedExpenses: FixedExpense[];
  variableCategoryBases: Record<string, number>;
  fixedCategoryBases: Record<string, number>;
  activeCategories: string[];
  categoryColors: Record<string, string>;
  categoryIcons: Record<string, string>;
  updatedAt: string;
}

export interface UserProfile {
  plan: 'free' | 'pro';
  currency: string;
  onboardingComplete: boolean;
  displayName?: string;
  theme?: 'light' | 'dark' | 'system';
  language?: 'en' | 'fr' | 'ar';
  householdMembers?: string[];
}

/**
 * Strategy Envelope Amounts Calculation
 * Needs + Wants + Savings MUST sum to exactly income with no rounding leak.
 * Savings envelope absorbs any rounding remainder.
 */
export function calculateEnvelopeAmounts(income: number, strategyId: StrategyId): { needs: number; wants: number; savings: number } {
  const safeIncome = Math.max(0, isNaN(income) || !isFinite(income) ? 0 : Math.round(income * 100) / 100);
  const strategy = STRATEGIES[strategyId] || STRATEGIES['50-30-20'];

  const needs = Math.floor(safeIncome * strategy.needsRatio);
  const wants = Math.floor(safeIncome * strategy.wantsRatio);
  const savings = safeIncome - (needs + wants);

  return { needs, wants, savings };
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
  kind: ExpenseKind = 'variable'
): Record<string, number> {
  const { needs, wants } = calculateEnvelopeAmounts(income, strategyId);
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
 * Normalizes a raw Firestore month document, backfilling missing or legacy properties.
 */
export function normalizeMonth(raw: Partial<MonthBudget> | null | undefined, monthKey?: string): MonthBudget {
  const fallbackIncome = raw?.totalBudget ?? 0;
  const defaultEnvelopes = calculateEnvelopeAmounts(fallbackIncome, raw?.strategyId || '50-30-20');

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

  return {
    totalBudget,
    incomeSources,
    bankPart,
    homePart,
    walletPart,
    strategyId: raw?.strategyId || '50-30-20',
    monthlySavingsTarget: raw?.monthlySavingsTarget ?? defaultEnvelopes.savings,
    variableExpenses,
    fixedExpenses,
    variableCategoryBases: raw?.variableCategoryBases || {},
    fixedCategoryBases: raw?.fixedCategoryBases || {},
    activeCategories: raw?.activeCategories || defaultCategories,
    categoryColors: { ...defaultColors, ...(raw?.categoryColors || {}) },
    categoryIcons: { ...defaultIcons, ...(raw?.categoryIcons || {}) },
    updatedAt: raw?.updatedAt || new Date().toISOString(),
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
  monthKey: string
): MonthBudget {
  const { savings } = calculateEnvelopeAmounts(income, strategyId);

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
    monthlySavingsTarget: savings,
    fixedExpenses,
    variableExpenses: [],
    activeCategories: categories.length > 0 ? categories : undefined,
  }, monthKey);
}
