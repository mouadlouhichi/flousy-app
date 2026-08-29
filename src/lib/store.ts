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
  /** Day of the month (1–31) this salary/income is paid, when it is a
   * recurring monthly payment. Used to show the payment start date and, when
   * present, to shift the budget period for the source. */
  payDay?: number;
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
  /**
   * Money that was actually transferred INTO this goal through a deposit
   * (the fund flow, or an opening balance moved out of a tracked money
   * place via the transfer checkbox). "Already saved" balances recorded
   * without that checkbox are pure bookkeeping and are NOT counted here,
   * so the home-screen savings plan only reflects real deposits.
   */
  deposited?: number;
}

/** One savings deposit / withdrawal logged on the month for Recent Activity. */
export interface SavingsActivityEntry {
  id: string;
  goalId: string;
  goalName: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  date: string; // ISO timestamp
  /**
   * Money place the deposit was taken from / the withdrawal was paid back
   * into. Older entries may omit it — the goal's source place is used then.
   */
  place?: MoneyPlace;
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
  /** Deposit / withdrawal log feeding the home-screen Recent Activity list. */
  savingsActivity?: SavingsActivityEntry[];
  updatedAt: string;
  updatedByUserId?: string;
}

export interface UserProfile {
  plan: 'free' | 'pro';
  /** Billing cycle selected at checkout (Firebase-backed, mirrors `plan`). */
  planBillingCycle?: 'monthly' | 'annual';
  /** Next billing date (YYYY-MM-DD) written to Firebase when `plan` upgrades. */
  planNextBillingDate?: string;
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
  /** Global preference for the day of the month a budget month starts.
   * Mirrors the per-source salary start date used by Income Sources. */
  monthStartDate?: number;
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

/** Cash currently held at a money place for the month. */
export function getPlaceBalance(
  month: Pick<MonthBudget, 'bankPart' | 'homePart' | 'walletPart'>,
  place: MoneyPlace,
): number {
  return month[`${place}Part`] || 0;
}

/**
 * Cash available in `place` for a NEW or EDITED expense / fixed bill.
 *
 * `balances` is the live balance per money place (e.g. the month's
 * bankPart / homePart / walletPart). Editing first refunds the previous
 * charge, so when the charge stays in the same place its old amount can be
 * spent again right away; when it moves to another place the old place is
 * freed and the new one is charged.
 */
export function availableForCharge(
  balances: Record<MoneyPlace, number | undefined> | null | undefined,
  place: MoneyPlace,
  previousCharge?: { place?: MoneyPlace; amount?: number } | null,
): number {
  let available = Math.max(0, balances?.[place] ?? 0);
  if (previousCharge && (previousCharge.place || 'bank') === place) {
    available += Math.max(0, previousCharge.amount || 0);
  }
  return available;
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

/** Cap for the per-month savings activity log (mirrored in firestore.rules). */
export const MAX_SAVINGS_ACTIVITY = 200;

/**
 * Prepend a savings deposit/withdrawal to the month's Recent Activity log.
 */
function withSavingsActivity(
  month: MonthBudget,
  entry: Omit<SavingsActivityEntry, 'id'>,
): MonthBudget {
  const logged: SavingsActivityEntry = {
    ...entry,
    id: `sav-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  };

  return {
    ...month,
    savingsActivity: [logged, ...(month.savingsActivity || [])].slice(0, MAX_SAVINGS_ACTIVITY),
    updatedAt: new Date().toISOString(),
  };
}

/** Sum of money actually deposited into goals (excludes bookkeeping balances). */
export function calculateDepositedSavings(goals: SavingGoal[]): number {
  return (goals || []).reduce((acc, g) => acc + (g.deposited ?? 0), 0);
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

  if (actualAmount <= 0) return { month, goals };

  const goal = goals.find((g) => g.id === goalId);

  const updatedMonth = withSavingsActivity(
    {
      ...month,
      [`${sourcePlace}Part`]: currentBalance - actualAmount,
    },
    {
      goalId,
      goalName: goal?.name || 'Savings goal',
      type: 'deposit',
      amount: actualAmount,
      date: new Date().toISOString(),
      place: sourcePlace,
    },
  );

  const updatedGoals = goals.map((g) => {
    if (g.id === goalId) {
      return {
        ...g,
        current: g.current + actualAmount,
        deposited: (g.deposited ?? 0) + actualAmount,
        source: sourcePlace,
      };
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

  if (actualWithdraw <= 0) return { month, goals };

  const updatedMonth = withSavingsActivity(
    {
      ...month,
      [`${targetPlace}Part`]: (month[`${targetPlace}Part`] || 0) + actualWithdraw,
    },
    {
      goalId,
      goalName: goal.name,
      type: 'withdraw',
      amount: actualWithdraw,
      date: new Date().toISOString(),
      place: targetPlace,
    },
  );

  const updatedGoals = goals.map((g) => {
    if (g.id === goalId) {
      return {
        ...g,
        current: g.current - actualWithdraw,
        // Money left the goal, so it no longer counts as deposited savings.
        deposited: Math.max(0, (g.deposited ?? 0) - actualWithdraw),
      };
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
  const previousDeposited = Math.max(0, existing?.deposited ?? 0);
  const requested = Math.max(0, Number.isFinite(goal.current) ? goal.current : 0);

  let nextCurrent = requested;
  let nextDeposited = previousDeposited;
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
      // A checked transfer is a real deposit into the goal.
      if (actual > 0) {
        nextDeposited = previousDeposited + actual;
        nextMonth = withSavingsActivity(nextMonth, {
          goalId: goal.id,
          goalName: goal.name,
          type: 'deposit',
          amount: actual,
          date: new Date().toISOString(),
          place: deductFromPlace,
        });
      }
    } else if (delta < 0) {
      nextMonth = {
        ...month,
        [`${deductFromPlace}Part`]: balance + -delta,
        updatedAt: new Date().toISOString(),
      };
      // Money returned to a tracked place is no longer deposited savings.
      nextDeposited = Math.max(0, previousDeposited + delta);
      if (-delta > 0) {
        nextMonth = withSavingsActivity(nextMonth, {
          goalId: goal.id,
          goalName: goal.name,
          type: 'withdraw',
          amount: -delta,
          date: new Date().toISOString(),
          place: deductFromPlace,
        });
      }
    }
  }

  // Bookkeeping balances (unchecked checkbox) never change `deposited` — they
  // are not real deposits. Keep the tracker consistent with the goal balance.
  nextDeposited = Math.min(nextDeposited, nextCurrent);

  const nextGoal: SavingGoal = {
    ...goal,
    current: nextCurrent,
    deposited: Math.max(0, nextDeposited),
  };
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
    // The goal's balance goes back to its source place, so its deposits are no
    // longer part of this month's savings plan — drop them from the log.
    savingsActivity: (month.savingsActivity || []).filter((evt) => evt.goalId !== goalId),
    updatedAt: new Date().toISOString(),
  };

  const updatedGoals = goals.filter((g) => g.id !== goalId);

  return { month: updatedMonth, goals: updatedGoals };
}

/**
 * Savings deposit log — editing & deleting entries
 *
 * The month's `savingsActivity` log is the source of truth for the savings
 * plan (see `calculateMonthlyDepositedSavings`), so correcting or removing an
 * entry has to move the same money back: the goal balance AND the money place
 * the entry touched.
 */

/**
 * Move the cash of one logged entry. `direction = 1` applies it, `-1` undoes
 * it (used when an entry is edited or deleted).
 *
 * Returns the amount that actually moved: like funding / withdrawing a goal,
 * an entry can never pull more cash out of a money place or a goal than they
 * hold — otherwise editing an entry would invent (or destroy) money.
 */
function moveSavingsEntryCash(
  month: MonthBudget,
  goals: SavingGoal[],
  entry: Pick<SavingsActivityEntry, 'goalId' | 'type' | 'amount' | 'place'>,
  direction: 1 | -1,
): { month: MonthBudget; goals: SavingGoal[]; applied: number } {
  const amount = Math.max(0, Number.isFinite(entry.amount) ? entry.amount : 0);
  const goal = goals.find((g) => g.id === entry.goalId);
  if (amount === 0 || !goal) return { month, goals, applied: 0 };

  const place: MoneyPlace = entry.place || goal?.source || 'bank';
  const placeKey = `${place}Part` as const;
  const placeBalance = month[placeKey] || 0;
  const goalBalance = Math.max(0, goal?.current ?? 0);

  // Side the cash is taken from: applying a deposit pulls from the money place
  // (undoing it pulls back out of the goal), and mirrored for withdrawals.
  const available = (entry.type === 'deposit') === (direction === 1) ? placeBalance : goalBalance;
  const applied = Math.min(amount, available);

  // A deposit pulls cash out of the place into the goal; a withdrawal pushes
  // it back out of the goal into the place.
  const placeDelta = entry.type === 'deposit' ? -applied * direction : applied * direction;
  const goalDelta = -placeDelta;

  const nextMonth: MonthBudget = {
    ...month,
    [placeKey]: Math.max(0, placeBalance + placeDelta),
  };

  const nextCurrent = Math.max(0, goalBalance + goalDelta);
  const nextGoals = goals.map((g) =>
    g.id === goal.id
      ? {
          ...g,
          current: nextCurrent,
          // Deposited savings track the goal balance, never exceed it.
          deposited: Math.min(nextCurrent, Math.max(0, (g.deposited ?? 0) + goalDelta)),
        }
      : g,
  );

  return { month: nextMonth, goals: nextGoals, applied };
}

/** Sort the activity log newest-first (stable for equal timestamps). */
function sortSavingsActivity(entries: SavingsActivityEntry[]): SavingsActivityEntry[] {
  return [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Edit a logged deposit / withdrawal: the old movement is undone and the new
 * one applied, so balances, money places and the savings plan all follow.
 */
export function updateSavingsActivityEntry(
  month: MonthBudget,
  goals: SavingGoal[],
  entryId: string,
  patch: Partial<Pick<SavingsActivityEntry, 'amount' | 'type' | 'goalId' | 'place' | 'date'>>,
): { month: MonthBudget; goals: SavingGoal[] } {
  const entry = (month.savingsActivity || []).find((evt) => evt.id === entryId);
  if (!entry) return { month, goals };

  const requestedAmount =
    patch.amount === undefined
      ? entry.amount
      : Math.max(0, Number.isFinite(patch.amount) ? patch.amount : entry.amount);

  const candidate: SavingsActivityEntry = {
    ...entry,
    ...patch,
    amount: requestedAmount,
    goalName: (patch.goalId ? goals.find((g) => g.id === patch.goalId)?.name : undefined) || entry.goalName,
  };

  // Undo the old movement, then apply the edited one. The logged amount always
  // matches the money that really moved.
  const undone = moveSavingsEntryCash(month, goals, entry, -1);
  const reapplied = moveSavingsEntryCash(undone.month, undone.goals, candidate, 1);
  const goalExists = goals.some((g) => g.id === candidate.goalId);
  const nextEntry: SavingsActivityEntry = {
    ...candidate,
    amount: goalExists ? reapplied.applied : requestedAmount,
  };

  return {
    month: {
      ...reapplied.month,
      savingsActivity: sortSavingsActivity(
        (reapplied.month.savingsActivity || []).map((evt) => (evt.id === entryId ? nextEntry : evt)),
      ),
      updatedAt: new Date().toISOString(),
    },
    goals: reapplied.goals,
  };
}

/**
 * Delete a logged deposit / withdrawal and put the money back where it came
 * from, so the savings plan stops counting it.
 */
export function deleteSavingsActivityEntry(
  month: MonthBudget,
  goals: SavingGoal[],
  entryId: string,
): { month: MonthBudget; goals: SavingGoal[] } {
  const entry = (month.savingsActivity || []).find((evt) => evt.id === entryId);
  if (!entry) return { month, goals };

  const undone = moveSavingsEntryCash(month, goals, entry, -1);

  return {
    month: {
      ...undone.month,
      savingsActivity: (undone.month.savingsActivity || []).filter((evt) => evt.id !== entryId),
      updatedAt: new Date().toISOString(),
    },
    goals: undone.goals,
  };
}

/**
 * Deposits and withdrawals logged on THIS month.
 *
 * Savings goals live outside the month (a goal outlives the budget period), so
 * the per-goal `deposited` counter is a lifetime figure and must never be used
 * for a monthly plan: a 400 deposit made last month plus a 400 deposit this
 * month would otherwise read as 800 saved in the current month.
 */
export function calculateMonthlySavingsFlow(month: MonthBudget): {
  deposits: number;
  withdrawals: number;
  net: number;
} {
  let deposits = 0;
  let withdrawals = 0;

  for (const evt of month?.savingsActivity || []) {
    const amount = Math.max(0, Number.isFinite(evt?.amount) ? evt.amount : 0);
    if (evt?.type === 'deposit') deposits += amount;
    else if (evt?.type === 'withdraw') withdrawals += amount;
  }

  return { deposits, withdrawals, net: Math.max(0, deposits - withdrawals) };
}

/** Money deposited into savings goals during this budget month. */
export function calculateMonthlyDepositedSavings(month: MonthBudget): number {
  return calculateMonthlySavingsFlow(month).net;
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
    savingsActivity: (raw?.savingsActivity || [])
      .filter((evt) => evt && (evt.type === 'deposit' || evt.type === 'withdraw'))
      .slice(0, MAX_SAVINGS_ACTIVITY)
      .map((evt) => ({
        id: evt.id || Math.random().toString(36).substring(2, 9),
        goalId: evt.goalId || '',
        goalName: evt.goalName || 'Savings goal',
        type: evt.type,
        amount: typeof evt.amount === 'number' && evt.amount >= 0 ? evt.amount : 0,
        date: evt.date || new Date().toISOString(),
        ...(evt.place === 'bank' || evt.place === 'home' || evt.place === 'wallet'
          ? { place: evt.place }
          : {}),
      })),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

/**
 * Carries over recurring fixed expenses from a previous month into a new month.
 * Only copies bills with `recurring: true`.
 *
 * Each carried bill reduces the money place it is actually paid from
 * (`bill.place`), not blanket-debited from the bank.
 */
export function carryOverFixedExpenses(
  newMonth: MonthBudget,
  previousMonth: MonthBudget,
): MonthBudget {
  const recurringBills = (previousMonth.fixedExpenses || []).filter((b) => b.recurring !== false);
  if (recurringBills.length === 0) return newMonth;

  const existingIds = new Set((newMonth.fixedExpenses || []).map((b) => b.id));
  const toCarry = recurringBills.filter((b) => !existingIds.has(b.id));
  if (toCarry.length === 0) return newMonth;

  // Recreate IDs so they don't collide
  const carried = toCarry.map((b) => ({
    ...b,
    id: `carry-${b.id}-${Date.now()}`,
    date: b.date || '1st',
  }));

  const parts: Record<MoneyPlace, number> = {
    bank: newMonth.bankPart || 0,
    home: newMonth.homePart || 0,
    wallet: newMonth.walletPart || 0,
  };
  carried.forEach((b) => {
    const place: MoneyPlace = b.place || 'bank';
    parts[place] = Math.max(0, (parts[place] || 0) - b.amount);
  });

  return {
    ...newMonth,
    fixedExpenses: [...(newMonth.fixedExpenses || []), ...carried],
    bankPart: parts.bank,
    homePart: parts.home,
    walletPart: parts.wallet,
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
