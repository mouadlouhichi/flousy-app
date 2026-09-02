export type Envelope = 'needs' | 'wants' | 'savings';
export type BuiltinMoneyPlace = 'bank' | 'home' | 'wallet';
/** Built-in or user-defined money source id (bank, wallet, a custom cash jar…). */
export type MoneyPlace = string;
export type StrategyId = '50-30-20' | '70-20-10' | '80-20' | 'zero-based' | 'envelope' | 'pay-first' | 'custom';
export type ExpenseKind = 'variable' | 'fixed';
export type LifecycleStatus = 'planned' | 'partial' | 'paid' | 'skipped';

/** Domain error thrown before a mutation can create or destroy cash. */
export class MoneyInvariantError extends Error {
  constructor(
    public readonly code: 'invalid-amount' | 'insufficient-funds' | 'duplicate-id' | 'not-found' | 'outside-period',
    message: string,
  ) {
    super(message);
    this.name = 'MoneyInvariantError';
  }
}

/** Keep every persisted monetary value finite, non-negative and cent-precise. */
export function money(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new MoneyInvariantError('invalid-amount', 'Amount must be a finite non-negative number.');
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function positiveMoney(value: number): number {
  const rounded = money(value);
  if (rounded <= 0) throw new MoneyInvariantError('invalid-amount', 'Amount must be greater than zero.');
  return rounded;
}

function entityId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

/** A tracked cash location the user can rename, add or remove from Profile. */
export interface MoneyPlaceConfig {
  id: string;
  name: string;
  icon: string;
}

export const DEFAULT_MONEY_PLACES: MoneyPlaceConfig[] = [
  { id: 'bank', name: 'Bank', icon: 'account_balance' },
  { id: 'home', name: 'Home Cash', icon: 'home' },
  { id: 'wallet', name: 'Wallet', icon: 'account_balance_wallet' },
];

/** Icons offered when adding or editing a money source. */
export const MONEY_PLACE_ICON_CHOICES = [
  'account_balance',
  'home',
  'account_balance_wallet',
  'payments',
  'credit_card',
  'savings',
  'local_atm',
  'store',
  'work',
  'phone_iphone',
  'travel_explore',
  'school',
] as const;

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
  /** Expected amount for this budget period. */
  amount: number;
  status?: LifecycleStatus;
  /** Cash actually received. Legacy sources default to their full amount. */
  receivedAmount?: number;
  receivedAt?: string;
  recurring?: boolean;
  templateId?: string;
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
  sourceType?: 'invoice' | 'course' | 'csv' | 'manual';
  sourceId?: string;
  importFingerprint?: string;
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
  /** Explicit template identity used to create one planned occurrence per period. */
  templateId?: string;
  status?: LifecycleStatus;
  /** Amount that has actually left the selected money place. */
  paidAmount?: number;
  paidAt?: string;
  receiptUrl?: string;
  sourceType?: 'invoice' | 'csv' | 'manual';
  sourceId?: string;
  importFingerprint?: string;
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

/** Icons for the default fixed categories, so list rows match the modal. */
export const FIXED_TYPE_ICONS: Record<string, string> = {
  Rent: 'home',
  Utilities: 'bolt',
  Housing: 'house',
  Subscriptions: 'subscriptions',
  Insurance: 'shield',
  Internet: 'wifi',
  Gym: 'fitness_center',
  Other: 'label',
};

/** Colors for the default fixed categories. */
export const FIXED_TYPE_COLORS: Record<string, string> = {
  Rent: '#8b5cf6',
  Utilities: '#eab308',
  Housing: '#f97316',
  Subscriptions: '#6366f1',
  Insurance: '#10b981',
  Internet: '#06b6d4',
  Gym: '#ec4899',
  Other: '#6d7a77',
};

/**
 * Resolve the icon + colour a fixed bill's category should render with, in the
 * same precedence the Add/Edit modal uses: a month-level override, then a
 * user-defined category, then the default map. Shared so list rows and the
 * modal never disagree (a row used to fall back to a generic receipt icon).
 */
export function fixedCategoryVisual(
  name: string,
  opts?: {
    icons?: Record<string, string>;
    colors?: Record<string, string>;
    custom?: FixedCategoryItem[];
  },
): { icon: string; color: string } {
  const custom = opts?.custom?.find((c) => c.name === name);
  return {
    icon: opts?.icons?.[name] || custom?.icon || FIXED_TYPE_ICONS[name] || 'label',
    color: opts?.colors?.[name] || custom?.color || FIXED_TYPE_COLORS[name] || '#6d7a77',
  };
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

export interface DebtPayment {
  id: string;
  amount: number;
  date: string;
  place: MoneyPlace;
  note?: string;
  createdByUserId?: string;
}

export interface DebtItem {
  id: string;
  name: string;       // person/entity
  /** Original amount. Outstanding = amount - payment history. */
  amount: number;
  type: DebtType;     // 'debt' = I owe, 'credit' = owed to me
  status: DebtStatus;
  date: string;       // YYYY-MM-DD
  dueDate?: string;
  payments?: DebtPayment[];
  note?: string;
}

export interface AccountTransfer {
  id: string;
  from: MoneyPlace;
  to: MoneyPlace;
  amount: number;
  date: string;
  createdByUserId?: string;
}

export interface BalanceAdjustment {
  id: string;
  place: MoneyPlace;
  previousBalance: number;
  newBalance: number;
  delta: number;
  reason: 'reconciliation' | 'opening-balance' | 'income';
  note?: string;
  date: string;
  createdByUserId?: string;
}

export interface MonthBudget {
  /** Schema metadata is optional for legacy documents and backfilled on read. */
  schemaVersion?: number;
  revision?: number;
  lastMutationId?: string;
  periodKey?: string;
  periodStartDay?: number;
  periodStartDate?: string;
  periodEndDate?: string;
  /** Immutable display snapshot for this period; configuration changes affect future periods. */
  currency?: string;
  totalBudget: number; // total expected income
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
  transfers?: AccountTransfer[];
  balanceAdjustments?: BalanceAdjustment[];
  /** Deposit / withdrawal log feeding the home-screen Recent Activity list. */
  savingsActivity?: SavingsActivityEntry[];
  /** Balances for user-defined money sources (beyond bank / home / wallet). */
  placeBalances?: Record<string, number>;
  updatedAt: string;
  updatedByUserId?: string;
}

export interface UserProfile {
  plan: 'free' | 'pro';
  /** Immutable marker for the one-time beta Pro claim allowed by Firestore rules. */
  proTrialClaimedAt?: string;
  /** Billing cycle selected at checkout (Firebase-backed, mirrors `plan`). */
  planBillingCycle?: 'monthly' | 'annual';
  /** Next billing date (YYYY-MM-DD) written to Firebase when `plan` upgrades. */
  planNextBillingDate?: string;
  currency: string;
  onboardingComplete: boolean;
  displayName?: string;
  /** Persisted custom avatar (small data URL or HTTPS provider image). */
  avatarUrl?: string;
  theme?: 'light' | 'dark' | 'system';
  language?: 'en' | 'fr' | 'ar';
  householdMembers?: string[]; // legacy local person labels
  activeHouseholdId?: string;
  activeWorkspace?: 'personal' | 'household';
  householdIds?: string[];
  defaultCategoryBudgets?: Record<string, number>; // Pro feature: default budgets that persist across months
  enableRollover?: boolean; // Pro feature: carry unused budget to next month
  fixedCategories?: FixedCategoryItem[]; // user-defined fixed-bill categories
  /** Day of the month the PERSONAL budget month starts. Mirrors the
   * per-source salary start date used by Income Sources. */
  monthStartDate?: number;
  /** Legacy client preference; household documents now own this setting. */
  householdMonthStartDate?: number;
  /** Cash locations (Bank, Home, Wallet, plus any the user added). */
  moneyPlaces?: MoneyPlaceConfig[];
}

/** Defaults used only when a period does not already contain its own snapshot. */
export type MonthConfiguration = Partial<UserProfile> &
  Partial<Pick<MonthBudget, 'activeCategories' | 'categoryColors' | 'categoryIcons'>>;

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

/** Cash actually received from an income source in this period. */
export function incomeReceivedAmount(source: IncomeSource): number {
  const planned = Math.max(0, Number.isFinite(source.amount) ? source.amount : 0);
  // A missing status is legacy data: those balances were already credited in
  // earlier releases, so migration must treat the source as fully received.
  const status = source.status || 'paid';
  if (status === 'planned' || status === 'skipped') return 0;
  if (status === 'partial') {
    return Math.min(planned, Math.max(0, Number.isFinite(source.receivedAmount) ? source.receivedAmount! : 0));
  }
  return Math.min(planned, Math.max(0, Number.isFinite(source.receivedAmount) ? source.receivedAmount! : planned));
}

export function calculateReceivedIncome(
  month: Pick<MonthBudget, 'totalBudget' | 'incomeSources'>,
): number {
  const sources = month.incomeSources || [];
  if (sources.length === 0) return Math.max(0, month.totalBudget || 0);
  return money(sources.reduce((sum, source) => sum + incomeReceivedAmount(source), 0));
}

/** Cash actually paid for a fixed bill in this period. */
export function fixedPaidAmount(expense: FixedExpense): number {
  const planned = Math.max(0, Number.isFinite(expense.amount) ? expense.amount : 0);
  const status = expense.status || 'paid';
  if (status === 'planned' || status === 'skipped') return 0;
  if (status === 'partial') {
    return Math.min(planned, Math.max(0, Number.isFinite(expense.paidAmount) ? expense.paidAmount! : 0));
  }
  return Math.min(planned, Math.max(0, Number.isFinite(expense.paidAmount) ? expense.paidAmount! : planned));
}

export function debtOutstanding(debt: DebtItem): number {
  const paid = (debt.payments || []).reduce(
    (sum, payment) => sum + Math.max(0, Number.isFinite(payment.amount) ? payment.amount : 0),
    0,
  );
  return money(Math.max(0, (Number.isFinite(debt.amount) ? debt.amount : 0) - paid));
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

  // Custom categories are free text typed by the user, so they arrive in the
  // language the app is used in. The English list alone made a French "Salle de
  // sport" a want and an Arabic "إيجار" a want as well, which skewed the 50/30/20
  // split for exactly the households that rename their categories.
  const fixedWants = [
    'subscription', 'subscriptions', 'netflix', 'spotify', 'entertainment', 'leisure', 'gym', 'hobbies',
    'loisirs', 'abonnement', 'abonnements', 'cinéma', 'cinema', 'salle de sport', 'sport', 'vacances',
    'اشتراك', 'اشتراكات', 'ترفيه', 'رياضة', 'نادي', 'صالة', 'هوايات', 'سينما',
  ];
  const variableNeeds = [
    'groceries', 'food', 'food & drink', 'alimentation', 'health', 'santé', 'medical', 'pharmacy',
    'transport', 'transportation', 'car', 'fuel', 'utilities', 'housing', 'rent',
    'courses', 'épicerie', 'medecin', 'médecin', 'pharmacie', 'essence', 'carburant',
    'loyer', 'électricité', 'eau', 'gaz', 'scolarité', 'école',
    'بقالة', 'طعام', 'غذاء', 'صحة', 'دواء', 'صيدلية', 'نقل', 'سيارة', 'بنزين', 'وقود',
    'كهرباء', 'ماء', 'غاز', 'إيجار', 'ايجار', 'سكن', 'مدرسة', 'تعليم',
  ];

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
    const paid = fixedPaidAmount(exp);
    const bucket = bucketOf(exp.type, 'fixed');
    if (bucket === 'needs') needs += paid;
    else if (bucket === 'wants') wants += paid;
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

export function isBuiltinMoneyPlace(place: string): place is BuiltinMoneyPlace {
  return place === 'bank' || place === 'home' || place === 'wallet';
}

export function resolveMoneyPlaces(profile?: Pick<UserProfile, 'moneyPlaces'> | null): MoneyPlaceConfig[] {
  const configured = (profile?.moneyPlaces || []).filter(
    (p) => p && typeof p.id === 'string' && p.id && typeof p.name === 'string' && p.name.trim(),
  );
  if (configured.length === 0) return DEFAULT_MONEY_PLACES.map((p) => ({ ...p }));
  return configured.map((p) => ({
    id: p.id,
    name: p.name.trim(),
    icon: p.icon || DEFAULT_MONEY_PLACES.find((d) => d.id === p.id)?.icon || 'payments',
  }));
}

export function moneyPlaceLabel(place: string, places?: MoneyPlaceConfig[]): string {
  const list = places && places.length > 0 ? places : DEFAULT_MONEY_PLACES;
  const match = list.find((p) => p.id === place);
  if (match) return match.name;
  if (place === 'home') return 'Home Cash';
  if (place === 'bank') return 'Bank';
  if (place === 'wallet') return 'Wallet';
  return place;
}

export function moneyPlaceIcon(place: string, places?: MoneyPlaceConfig[]): string {
  const list = places && places.length > 0 ? places : DEFAULT_MONEY_PLACES;
  return list.find((p) => p.id === place)?.icon
    || DEFAULT_MONEY_PLACES.find((p) => p.id === place)?.icon
    || 'payments';
}

type PlaceBalanceMonth = Pick<MonthBudget, 'bankPart' | 'homePart' | 'walletPart'> & {
  placeBalances?: Record<string, number>;
};

/** Cash currently held at a money place for the month. */
export function getPlaceBalance(month: PlaceBalanceMonth, place: MoneyPlace): number {
  if (place === 'bank') return month.bankPart || 0;
  if (place === 'home') return month.homePart || 0;
  if (place === 'wallet') return month.walletPart || 0;
  return month.placeBalances?.[place] || 0;
}

export function withPlaceBalance(month: MonthBudget, place: MoneyPlace, value: number): MonthBudget {
  if (!place || typeof place !== 'string') {
    throw new MoneyInvariantError('invalid-amount', 'A valid money source is required.');
  }
  if (!Number.isFinite(value) || value < -0.005) {
    throw new MoneyInvariantError('insufficient-funds', `Money source “${place}” does not have enough funds.`);
  }
  const next = money(Math.max(0, value));
  if (place === 'bank') return { ...month, bankPart: next };
  if (place === 'home') return { ...month, homePart: next };
  if (place === 'wallet') return { ...month, walletPart: next };
  return { ...month, placeBalances: { ...(month.placeBalances || {}), [place]: next } };
}

export function adjustPlaceBalance(month: MonthBudget, place: MoneyPlace, delta: number): MonthBudget {
  if (!Number.isFinite(delta)) {
    throw new MoneyInvariantError('invalid-amount', 'Balance change must be finite.');
  }
  return withPlaceBalance(month, place, getPlaceBalance(month, place) + delta);
}

export function totalCashOnHand(month: PlaceBalanceMonth): number {
  const custom = Object.values(month.placeBalances || {}).reduce((acc, value) => acc + (Number(value) || 0), 0);
  return (month.bankPart || 0) + (month.homePart || 0) + (month.walletPart || 0) + custom;
}

export function placeBalancesOf(month: PlaceBalanceMonth, places?: MoneyPlaceConfig[]): Record<string, number> {
  const list = places && places.length > 0 ? places : DEFAULT_MONEY_PLACES;
  const rec: Record<string, number> = {};
  for (const p of list) rec[p.id] = getPlaceBalance(month, p.id);
  return rec;
}

export function nextMoneyPlaceId(name: string, existingIds: string[]): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'place';
  const taken = new Set(existingIds);
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

export function addMoneyPlace(profile: UserProfile, item: MoneyPlaceConfig): UserProfile {
  const existing = resolveMoneyPlaces(profile);
  const id = item.id.trim();
  const name = item.name.trim();
  if (!id || !name) return profile;
  if (existing.some((p) => p.id === id || p.name.toLowerCase() === name.toLowerCase())) return profile;
  return { ...profile, moneyPlaces: [...existing, { id, name, icon: item.icon || 'payments' }] };
}

export function updateMoneyPlace(
  profile: UserProfile,
  id: string,
  patch: Partial<Pick<MoneyPlaceConfig, 'name' | 'icon'>>,
): UserProfile {
  const existing = resolveMoneyPlaces(profile);
  const idx = existing.findIndex((p) => p.id === id);
  if (idx === -1) return profile;
  const name = patch.name !== undefined ? patch.name.trim() : existing[idx].name;
  if (!name) return profile;
  if (existing.some((p, i) => i !== idx && p.name.toLowerCase() === name.toLowerCase())) return profile;
  const next = [...existing];
  next[idx] = { ...existing[idx], name, icon: patch.icon || existing[idx].icon };
  return { ...profile, moneyPlaces: next };
}

export function removeMoneyPlace(profile: UserProfile, id: string): UserProfile {
  const existing = resolveMoneyPlaces(profile);
  if (existing.length <= 1) return profile;
  if (!existing.some((p) => p.id === id)) return profile;
  return { ...profile, moneyPlaces: existing.filter((p) => p.id !== id) };
}

/** Move a retired place's leftover cash into `fallback` and drop its extra balance key. */
export function retireMoneyPlace(month: MonthBudget, placeId: string, fallback: MoneyPlace): MonthBudget {
  if (!placeId || placeId === fallback) return month;
  const moving = getPlaceBalance(month, placeId);
  let next = withPlaceBalance(month, fallback, getPlaceBalance(month, fallback) + moving);
  if (isBuiltinMoneyPlace(placeId)) {
    next = withPlaceBalance(next, placeId, 0);
  } else {
    const rest = { ...(next.placeBalances || {}) };
    delete rest[placeId];
    next = { ...next, placeBalances: rest };
  }
  return { ...next, updatedAt: new Date().toISOString() };
}

/** Move leftover cash and retarget expenses / activity after a place is removed. */
export function reassignMoneyPlace(month: MonthBudget, from: MoneyPlace, to: MoneyPlace): MonthBudget {
  if (!from || from === to) return month;
  const next = retireMoneyPlace(month, from, to);
  return {
    ...next,
    variableExpenses: (next.variableExpenses || []).map((e) => (e.place === from ? { ...e, place: to } : e)),
    fixedExpenses: (next.fixedExpenses || []).map((e) => (e.place === from ? { ...e, place: to } : e)),
    savingsActivity: (next.savingsActivity || []).map((e) => (e.place === from ? { ...e, place: to } : e)),
  };
}

export function reassignGoalSources(goals: SavingGoal[], from: MoneyPlace, to: MoneyPlace): SavingGoal[] {
  if (!from || from === to) return goals;
  return goals.map((g) => (g.source === from ? { ...g, source: to } : g));
}

function assertExpenseDateInPeriod(month: MonthBudget, date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new MoneyInvariantError('outside-period', 'Expense date must use YYYY-MM-DD.');
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new MoneyInvariantError('outside-period', 'Expense date is not a valid calendar date.');
  }
  if (
    (month.periodStartDate && date < month.periodStartDate) ||
    (month.periodEndDate && date > month.periodEndDate)
  ) {
    throw new MoneyInvariantError('outside-period', 'Expense date falls outside this budget period.');
  }
}

function canonicalVariableExpense(expense: VariableExpense): VariableExpense {
  return { ...expense, amount: positiveMoney(expense.amount), place: expense.place || 'bank' };
}

export function addVariableExpense(month: MonthBudget, expense: VariableExpense): MonthBudget {
  if ((month.variableExpenses || []).some((item) => item.id === expense.id)) return month;
  assertExpenseDateInPeriod(month, expense.date);
  const nextExpense = canonicalVariableExpense(expense);
  return {
    ...adjustPlaceBalance(month, nextExpense.place, -nextExpense.amount),
    variableExpenses: [nextExpense, ...(month.variableExpenses || [])],
    updatedAt: new Date().toISOString(),
  };
}

export function editVariableExpense(month: MonthBudget, oldExpense: VariableExpense, newExpense: VariableExpense): MonthBudget {
  const existing = (month.variableExpenses || []).find((expense) => expense.id === oldExpense.id);
  if (!existing) throw new MoneyInvariantError('not-found', 'The expense no longer exists.');
  assertExpenseDateInPeriod(month, newExpense.date);
  const candidate = canonicalVariableExpense({
    ...newExpense,
    id: existing.id,
    payerMemberId: newExpense.payerMemberId ?? existing.payerMemberId,
    createdByUserId: existing.createdByUserId ?? newExpense.createdByUserId,
    sourceType: existing.sourceType ?? newExpense.sourceType,
    sourceId: existing.sourceId ?? newExpense.sourceId,
    importFingerprint: existing.importFingerprint ?? newExpense.importFingerprint,
  });
  let next = adjustPlaceBalance(month, existing.place || 'bank', existing.amount);
  next = adjustPlaceBalance(next, candidate.place, -candidate.amount);
  return {
    ...next,
    variableExpenses: (month.variableExpenses || []).map((expense) =>
      expense.id === existing.id ? candidate : expense,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function deleteVariableExpense(month: MonthBudget, expense: VariableExpense): MonthBudget {
  const existing = (month.variableExpenses || []).find((item) => item.id === expense.id);
  // Idempotent deletion is essential for replaying queued mutations: a retry
  // must never refund an expense twice.
  if (!existing) return month;
  return {
    ...adjustPlaceBalance(month, existing.place || 'bank', existing.amount),
    variableExpenses: (month.variableExpenses || []).filter((item) => item.id !== existing.id),
    updatedAt: new Date().toISOString(),
  };
}

function canonicalFixedExpense(expense: FixedExpense): FixedExpense {
  const amount = positiveMoney(expense.amount);
  const status = expense.status || 'paid';
  const paidAmount = fixedPaidAmount({ ...expense, amount, status });
  return {
    ...expense,
    amount,
    place: expense.place || 'bank',
    status,
    paidAmount,
    ...(status === 'paid' && !expense.paidAt ? { paidAt: new Date().toISOString() } : {}),
  };
}

export function addFixedExpense(month: MonthBudget, expense: FixedExpense): MonthBudget {
  if ((month.fixedExpenses || []).some((item) => item.id === expense.id)) return month;
  const candidate = canonicalFixedExpense(expense);
  return {
    ...adjustPlaceBalance(month, candidate.place, -fixedPaidAmount(candidate)),
    fixedExpenses: [candidate, ...(month.fixedExpenses || [])],
    updatedAt: new Date().toISOString(),
  };
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
  previousCharge?: { place?: MoneyPlace; amount?: number; status?: LifecycleStatus; paidAmount?: number } | null,
): number {
  let available = Math.max(0, balances?.[place] ?? 0);
  if (previousCharge && (previousCharge.place || 'bank') === place) {
    available += previousCharge.status
      ? fixedPaidAmount(previousCharge as FixedExpense)
      : Math.max(0, previousCharge.amount || 0);
  }
  return available;
}

export function editFixedExpense(month: MonthBudget, oldExpense: FixedExpense, newExpense: FixedExpense): MonthBudget {
  const existing = (month.fixedExpenses || []).find((expense) => expense.id === oldExpense.id);
  if (!existing) throw new MoneyInvariantError('not-found', 'The fixed bill no longer exists.');
  const candidate = canonicalFixedExpense({
    ...newExpense,
    id: existing.id,
    payerMemberId: newExpense.payerMemberId ?? existing.payerMemberId,
    createdByUserId: existing.createdByUserId ?? newExpense.createdByUserId,
    templateId: existing.templateId ?? newExpense.templateId,
    sourceType: existing.sourceType ?? newExpense.sourceType,
    sourceId: existing.sourceId ?? newExpense.sourceId,
    importFingerprint: existing.importFingerprint ?? newExpense.importFingerprint,
  });
  let next = adjustPlaceBalance(month, existing.place || 'bank', fixedPaidAmount(existing));
  next = adjustPlaceBalance(next, candidate.place, -fixedPaidAmount(candidate));
  return {
    ...next,
    fixedExpenses: (month.fixedExpenses || []).map((expense) =>
      expense.id === existing.id ? candidate : expense,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function deleteFixedExpense(month: MonthBudget, expense: FixedExpense): MonthBudget {
  const existing = (month.fixedExpenses || []).find((item) => item.id === expense.id);
  if (!existing) return month;
  return {
    ...adjustPlaceBalance(month, existing.place || 'bank', fixedPaidAmount(existing)),
    fixedExpenses: (month.fixedExpenses || []).filter((item) => item.id !== existing.id),
    updatedAt: new Date().toISOString(),
  };
}

export function moveMoney(
  month: MonthBudget,
  from: MoneyPlace,
  to: MoneyPlace,
  amount: number,
  createdByUserId?: string,
): MonthBudget {
  if (from === to) throw new MoneyInvariantError('invalid-amount', 'Transfer accounts must be different.');
  const transferAmount = positiveMoney(amount);
  const currentFrom = getPlaceBalance(month, from);
  if (transferAmount > currentFrom) {
    throw new MoneyInvariantError('insufficient-funds', `Money source “${from}” does not have enough funds.`);
  }
  let next = withPlaceBalance(month, from, currentFrom - transferAmount);
  next = withPlaceBalance(next, to, getPlaceBalance(next, to) + transferAmount);
  const transfer: AccountTransfer = {
    id: entityId('transfer'),
    from,
    to,
    amount: transferAmount,
    date: new Date().toISOString(),
    ...(createdByUserId ? { createdByUserId } : {}),
  };
  return {
    ...next,
    transfers: [transfer, ...(month.transfers || [])].slice(0, 500),
    updatedAt: transfer.date,
  };
}

export function updateMoneyPlaces(
  month: MonthBudget,
  values: Partial<Record<MoneyPlace, number>>,
  metadata: { reason?: BalanceAdjustment['reason']; note?: string; createdByUserId?: string } = {},
): MonthBudget {
  let next = month;
  const adjustments: BalanceAdjustment[] = [];
  for (const [place, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const previousBalance = getPlaceBalance(next, place);
    const newBalance = money(value);
    if (newBalance === previousBalance) continue;
    next = withPlaceBalance(next, place, newBalance);
    adjustments.push({
      id: entityId('adjustment'),
      place,
      previousBalance,
      newBalance,
      delta: money(Math.abs(newBalance - previousBalance)) * (newBalance < previousBalance ? -1 : 1),
      reason: metadata.reason || 'reconciliation',
      ...(metadata.note?.trim() ? { note: metadata.note.trim() } : {}),
      date: new Date().toISOString(),
      ...(metadata.createdByUserId ? { createdByUserId: metadata.createdByUserId } : {}),
    });
  }
  if (adjustments.length === 0) return month;
  return {
    ...next,
    balanceAdjustments: [...adjustments, ...(month.balanceAdjustments || [])].slice(0, 500),
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
  const actualAmount = positiveMoney(amount);
  const currentBalance = getPlaceBalance(month, sourcePlace);
  if (actualAmount > currentBalance) {
    throw new MoneyInvariantError('insufficient-funds', `Money source “${sourcePlace}” does not have enough funds.`);
  }

  const goal = goals.find((g) => g.id === goalId);
  if (!goal) throw new MoneyInvariantError('not-found', 'The savings goal no longer exists.');

  const updatedMonth = withSavingsActivity(
    withPlaceBalance(month, sourcePlace, currentBalance - actualAmount),
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
  if (!goal) throw new MoneyInvariantError('not-found', 'The savings goal no longer exists.');
  const actualWithdraw = positiveMoney(amount);
  if (actualWithdraw > goal.current) {
    throw new MoneyInvariantError('insufficient-funds', 'The savings goal does not have enough funds.');
  }

  const updatedMonth = withSavingsActivity(
    withPlaceBalance(month, targetPlace, getPlaceBalance(month, targetPlace) + actualWithdraw),
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
    const balance = getPlaceBalance(month, deductFromPlace);
    const delta = requested - previousCurrent;

    if (delta > 0) {
      if (delta > balance) {
        throw new MoneyInvariantError('insufficient-funds', `Money source “${deductFromPlace}” does not have enough funds.`);
      }
      const actual = money(delta);
      nextCurrent = previousCurrent + actual;
      nextMonth = {
        ...withPlaceBalance(month, deductFromPlace, balance - actual),
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
        ...withPlaceBalance(month, deductFromPlace, balance + -delta),
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
    ...adjustPlaceBalance(month, returnPlace, goal.current),
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
  const placeBalance = getPlaceBalance(month, place);
  const goalBalance = Math.max(0, goal?.current ?? 0);

  // Side the cash is taken from: applying a deposit pulls from the money place
  // (undoing it pulls back out of the goal), and mirrored for withdrawals.
  const available = (entry.type === 'deposit') === (direction === 1) ? placeBalance : goalBalance;
  const applied = Math.min(amount, available);

  // A deposit pulls cash out of the place into the goal; a withdrawal pushes
  // it back out of the goal into the place.
  const placeDelta = entry.type === 'deposit' ? -applied * direction : applied * direction;
  const goalDelta = -placeDelta;

  const nextMonth: MonthBudget = withPlaceBalance(month, place, placeBalance + placeDelta);

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

/** Record an installment and its matching cash movement in one month mutation. */
export function recordDebtPayment(
  month: MonthBudget,
  debtId: string,
  payment: DebtPayment,
): MonthBudget {
  const debt = (month.debts || []).find((item) => item.id === debtId);
  if (!debt) throw new MoneyInvariantError('not-found', 'The debt no longer exists.');
  if ((debt.payments || []).some((item) => item.id === payment.id)) return month;
  const amount = positiveMoney(payment.amount);
  if (amount > debtOutstanding(debt)) {
    throw new MoneyInvariantError('invalid-amount', 'Payment cannot exceed the outstanding balance.');
  }
  assertExpenseDateInPeriod(month, payment.date);
  const nextPayment: DebtPayment = { ...payment, amount, place: payment.place || 'bank' };
  const cashDelta = debt.type === 'debt' ? -amount : amount;
  const next = adjustPlaceBalance(month, nextPayment.place, cashDelta);
  const payments = [nextPayment, ...(debt.payments || [])];
  const updatedDebt: DebtItem = {
    ...debt,
    payments,
    status: money(debt.amount - payments.reduce((sum, item) => sum + item.amount, 0)) <= 0
      ? 'settled'
      : 'open',
  };
  return {
    ...next,
    debts: (month.debts || []).map((item) => item.id === debtId ? updatedDebt : item),
    updatedAt: new Date().toISOString(),
  };
}

/** Reverse one installment without ever allowing a second replay to mint cash. */
export function deleteDebtPayment(month: MonthBudget, debtId: string, paymentId: string): MonthBudget {
  const debt = (month.debts || []).find((item) => item.id === debtId);
  const payment = debt?.payments?.find((item) => item.id === paymentId);
  if (!debt || !payment) return month;
  // Reversing a debt payment returns cash; reversing received credit takes it
  // back out and therefore still observes the source balance guard.
  const cashDelta = debt.type === 'debt' ? payment.amount : -payment.amount;
  const next = adjustPlaceBalance(month, payment.place || 'bank', cashDelta);
  const payments = (debt.payments || []).filter((item) => item.id !== paymentId);
  const updatedDebt: DebtItem = { ...debt, payments, status: 'open' };
  return {
    ...next,
    debts: (month.debts || []).map((item) => item.id === debtId ? updatedDebt : item),
    updatedAt: new Date().toISOString(),
  };
}

function stableLegacyId(prefix: string, index: number, parts: unknown[]): string {
  const input = `${prefix}|${index}|${parts.map((part) => String(part ?? '')).join('|')}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-legacy-${(hash >>> 0).toString(36)}`;
}

function safeStoredMoney(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.round(Math.max(0, parsed) * 100) / 100;
}

function budgetPeriodBounds(monthKey: string | undefined, startDay: number): { startDate?: string; endDate?: string } {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return {};
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || month < 1 || month > 12) return {};
  const day = Math.min(Math.max(1, Math.round(startDay)), new Date(year, month, 0).getDate());
  const start = new Date(year, month - 1, day);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextDay = Math.min(Math.max(1, Math.round(startDay)), new Date(nextYear, nextMonth, 0).getDate());
  const end = new Date(nextYear, nextMonth - 1, nextDay - 1);
  const dateOnly = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { startDate: dateOnly(start), endDate: dateOnly(end) };
}

/**
 * Normalizes a raw Firestore month document, backfilling missing or legacy properties.
 * Handles rollover from previous month for Pro users. Unknown forward-compatible
 * fields and all attribution fields are retained instead of being erased by a read.
 */
export function normalizeMonth(
  raw: Partial<MonthBudget> | null | undefined,
  monthKey?: string,
  // `null` is how the auth context represents "signed out or still loading",
  // and every caller forwards that value straight through; requiring
  // `undefined` only forced `profile ?? undefined` at nine call sites.
  userProfile?: MonthConfiguration | null,
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

  const totalBudget = safeStoredMoney(raw?.totalBudget);
  const periodStartDay = Math.min(31, Math.max(1, Math.round(raw?.periodStartDay || userProfile?.monthStartDate || 1)));
  const bounds = budgetPeriodBounds(raw?.periodKey || monthKey, periodStartDay);
  const lifecycle = (status: unknown): LifecycleStatus | undefined =>
    status === 'planned' || status === 'partial' || status === 'paid' || status === 'skipped'
      ? status
      : undefined;

  const incomeSources: IncomeSource[] =
    raw?.incomeSources && raw.incomeSources.length > 0
      ? raw.incomeSources.map((source, index) => {
          const amount = safeStoredMoney(source.amount);
          const status = lifecycle(source.status) || 'paid';
          return {
            ...source,
            id: source.id || stableLegacyId('income', index, [source.name, amount, source.payDay]),
            name: source.name || 'Primary Income',
            amount,
            status,
            receivedAmount:
              status === 'paid'
                ? safeStoredMoney(source.receivedAmount, amount)
                : status === 'partial'
                  ? Math.min(amount, safeStoredMoney(source.receivedAmount))
                  : 0,
            recurring: source.recurring ?? true,
          };
        })
      : [{
          id: 'main-income',
          name: 'Primary Income',
          amount: totalBudget,
          status: 'paid',
          receivedAmount: totalBudget,
          recurring: true,
        }];

  const fallbackDate = raw?.periodStartDate || bounds.startDate || (monthKey ? `${monthKey}-01` : '1970-01-01');
  const variableExpenses: VariableExpense[] = (raw?.variableExpenses || []).map((exp, index) => ({
    ...exp,
    id: exp.id || stableLegacyId('expense', index, [exp.name, exp.amount, exp.date, exp.place]),
    name: exp.name || 'Expense',
    amount: safeStoredMoney(exp.amount),
    type: exp.type || 'Other',
    date: exp.date || fallbackDate,
    place: exp.place || 'bank',
    person: exp.person || 'Self',
    tags: exp.tags || [],
  }));

  const fixedExpenses: FixedExpense[] = (raw?.fixedExpenses || []).map((exp, index) => {
    const amount = safeStoredMoney(exp.amount);
    const status = lifecycle(exp.status) || 'paid';
    return {
      ...exp,
      id: exp.id || stableLegacyId('fixed', index, [exp.name, amount, exp.date, exp.place]),
      name: exp.name || 'Fixed Bill',
      amount,
      type: exp.type || 'Utilities',
      date: exp.date || '1st',
      place: exp.place || 'bank',
      person: exp.person || 'Self',
      recurring: exp.recurring ?? true,
      templateId: exp.templateId || exp.id,
      status,
      paidAmount:
        status === 'paid'
          ? safeStoredMoney(exp.paidAmount, amount)
          : status === 'partial'
            ? Math.min(amount, safeStoredMoney(exp.paidAmount))
            : 0,
    };
  });

  // Calculate sum of variable/fixed expenses paid per place if places weren't explicitly provided.
  const variableSpent = variableExpenses.reduce((acc, e) => acc + e.amount, 0);
  const fixedSpent = fixedExpenses.reduce((acc, e) => acc + fixedPaidAmount(e), 0);

  const receivedIncome = incomeSources.reduce((sum, source) => sum + incomeReceivedAmount(source), 0);
  const bankPart =
    typeof raw?.bankPart === 'number'
      ? safeStoredMoney(raw.bankPart)
      : safeStoredMoney(receivedIncome - variableSpent - fixedSpent);
  const homePart = safeStoredMoney(raw?.homePart);
  const walletPart = safeStoredMoney(raw?.walletPart);
  const placeBalances: Record<string, number> | undefined = raw?.placeBalances
    ? Object.fromEntries(
        Object.entries(raw.placeBalances)
          .filter(
            ([id, value]) => id && !isBuiltinMoneyPlace(id) && typeof value === 'number' && Number.isFinite(value),
          )
          .map(([id, value]) => [id, safeStoredMoney(value)]),
      )
    : undefined;

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
    ...(raw || {}),
    schemaVersion: Math.max(2, Math.floor(raw?.schemaVersion || 0)),
    revision: Math.max(0, Math.floor(raw?.revision || 0)),
    periodKey: raw?.periodKey || monthKey,
    periodStartDay,
    periodStartDate: raw?.periodStartDate || bounds.startDate,
    periodEndDate: raw?.periodEndDate || bounds.endDate,
    currency: raw?.currency || userProfile?.currency || 'MAD',
    totalBudget,
    incomeSources,
    bankPart,
    homePart,
    walletPart,
    ...(placeBalances && Object.keys(placeBalances).length > 0 ? { placeBalances } : {}),
    strategyId,
    ...(customRatios ? { customRatios } : {}),
    monthlySavingsTarget: safeStoredMoney(raw?.monthlySavingsTarget, defaultEnvelopes.savings),
    variableExpenses,
    fixedExpenses,
    variableCategoryBases: raw?.variableCategoryBases || {},
    fixedCategoryBases: raw?.fixedCategoryBases || {},
    categoryBudgets,
    rolloverFromPrevious,
    activeCategories: raw?.activeCategories || userProfile?.activeCategories || defaultCategories,
    categoryColors: {
      ...defaultColors,
      ...(userProfile?.categoryColors || {}),
      ...(raw?.categoryColors || {}),
    },
    categoryIcons: {
      ...defaultIcons,
      ...(userProfile?.categoryIcons || {}),
      ...(raw?.categoryIcons || {}),
    },
    debts: (raw?.debts || []).map((debt, debtIndex) => ({
      ...debt,
      id: debt.id || stableLegacyId('debt', debtIndex, [debt.name, debt.amount, debt.date]),
      name: debt.name || 'Unknown',
      amount: safeStoredMoney(debt.amount),
      type: debt.type === 'credit' ? 'credit' : 'debt',
      status: debt.status === 'settled' ? 'settled' : 'open',
      date: debt.date || fallbackDate,
      payments: (debt.payments || []).map((payment, paymentIndex) => ({
        ...payment,
        id: payment.id || stableLegacyId('debt-payment', paymentIndex, [debt.id, payment.amount, payment.date]),
        amount: safeStoredMoney(payment.amount),
        date: payment.date || fallbackDate,
        place: payment.place || 'bank',
      })),
    })),
    transfers: (raw?.transfers || []).slice(0, 500).map((transfer, index) => ({
      ...transfer,
      id: transfer.id || stableLegacyId('transfer', index, [transfer.from, transfer.to, transfer.amount, transfer.date]),
      from: transfer.from || 'bank',
      to: transfer.to || 'wallet',
      amount: safeStoredMoney(transfer.amount),
      date: transfer.date || `${fallbackDate}T00:00:00.000Z`,
    })),
    balanceAdjustments: (raw?.balanceAdjustments || []).slice(0, 500).map((adjustment, index) => ({
      ...adjustment,
      id: adjustment.id || stableLegacyId('adjustment', index, [adjustment.place, adjustment.delta, adjustment.date]),
      place: adjustment.place || 'bank',
      previousBalance: safeStoredMoney(adjustment.previousBalance),
      newBalance: safeStoredMoney(adjustment.newBalance),
      delta: Number.isFinite(adjustment.delta)
        ? Math.round(adjustment.delta * 100) / 100
        : safeStoredMoney(adjustment.newBalance) - safeStoredMoney(adjustment.previousBalance),
      reason: adjustment.reason || 'reconciliation',
      date: adjustment.date || `${fallbackDate}T00:00:00.000Z`,
    })),
    savingsActivity: (raw?.savingsActivity || [])
      .filter((evt) => evt && (evt.type === 'deposit' || evt.type === 'withdraw'))
      .slice(0, MAX_SAVINGS_ACTIVITY)
      .map((evt, index) => ({
        ...evt,
        id: evt.id || stableLegacyId('savings', index, [evt.goalId, evt.type, evt.amount, evt.date]),
        goalId: evt.goalId || '',
        goalName: evt.goalName || 'Savings goal',
        type: evt.type,
        amount: safeStoredMoney(evt.amount),
        date: evt.date || `${fallbackDate}T00:00:00.000Z`,
        ...(evt.place && typeof evt.place === 'string' ? { place: evt.place } : {}),
      })),
    updatedAt: raw?.updatedAt || `${fallbackDate}T00:00:00.000Z`,
  };
}

/** Materialize recurring expected income without crediting cash before receipt. */
export function carryOverIncomeSources(
  previousMonth: Pick<MonthBudget, 'incomeSources'>,
  periodKey: string,
): IncomeSource[] {
  return (previousMonth.incomeSources || [])
    .filter((source) => source.recurring !== false)
    .map((source) => {
      const templateId = source.templateId || source.id;
      return {
        ...source,
        id: `income-occurrence-${templateId}-${periodKey}`,
        templateId,
        status: 'planned',
        receivedAmount: 0,
        receivedAt: undefined,
      };
    });
}

/**
 * Materialize one planned occurrence from each recurring template. Carrying a
 * template must never debit cash: the debit happens only when the occurrence
 * becomes partial/paid. Deterministic IDs make retries idempotent.
 */
export function carryOverFixedExpenses(
  newMonth: MonthBudget,
  previousMonth: MonthBudget,
): MonthBudget {
  const recurringBills = (previousMonth.fixedExpenses || []).filter((bill) => bill.recurring !== false);
  if (recurringBills.length === 0) return newMonth;

  const existingTemplates = new Set(
    (newMonth.fixedExpenses || []).map((bill) => bill.templateId || bill.id),
  );
  const toCarry = recurringBills.filter((bill) => !existingTemplates.has(bill.templateId || bill.id));
  if (toCarry.length === 0) return newMonth;

  const period = newMonth.periodKey || newMonth.periodStartDate?.slice(0, 7) || 'next';
  const carried: FixedExpense[] = toCarry.map((bill) => {
    const templateId = bill.templateId || bill.id;
    return {
      ...bill,
      id: `fixed-occurrence-${templateId}-${period}`,
      templateId,
      date: bill.date || '1st',
      status: 'planned',
      paidAmount: 0,
      paidAt: undefined,
    };
  });

  return {
    ...newMonth,
    fixedExpenses: [...(newMonth.fixedExpenses || []), ...carried],
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
  const safeIncome = money(income);
  const resolvedCustomRatios =
    strategyId === 'custom' ? normalizeCustomRatios(customRatios) : undefined;
  const { savings } = calculateEnvelopeAmounts(safeIncome, strategyId, resolvedCustomRatios);

  const fixedExpenses: FixedExpense[] = bills.map((b, idx) => ({
    id: `fixed-${idx}-${Date.now()}`,
    templateId: `fixed-template-${idx}-${Date.now()}`,
    name: b.name,
    amount: money(b.amount),
    type: b.category,
    date: '1st',
    place: 'bank',
    recurring: true,
    status: 'paid',
    paidAmount: money(b.amount),
    paidAt: new Date().toISOString(),
  }));

  const totalFixed = fixedExpenses.reduce((acc, bill) => acc + fixedPaidAmount(bill), 0);
  if (totalFixed > safeIncome) {
    throw new MoneyInvariantError('insufficient-funds', 'Fixed bills cannot exceed received income.');
  }
  const remainingBank = money(safeIncome - totalFixed);

  return normalizeMonth({
    totalBudget: safeIncome,
    incomeSources: [{
      id: 'main-income',
      name: 'Primary Income',
      amount: safeIncome,
      status: 'paid',
      receivedAmount: safeIncome,
      recurring: true,
    }],
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

// --- Course session (shopping trip capture) ----------------------------------

/** Where a product's metadata came from. */
export type ProductSource = 'manual' | 'off' | 'session';

/** Lifecycle of a course session. */
export type SessionStatus = 'active' | 'completed';

/**
 * One known product, keyed by its normalized barcode (8 or 13 digits).
 * This is the user's self-learning catalog: every resolved product is
 * stored once and becomes an instant local hit afterwards.
 */
export interface Product {
  barcode: string; // doc id: 8 or 13 digits, checksum-verified
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  lastPrice?: number;
  priceUpdatedAt?: string;
  source: ProductSource;
  /** 'MA' for Moroccan products (GS1 prefix 611). */
  origin?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One line of a course session. Name/category are snapshots so the bill
 * renders identically even if the catalog entry changes or is deleted later.
 */
export interface SessionItem {
  key: string; // stable line id (the barcode when present, else generated)
  barcode?: string;
  name: string;
  category?: string;
  qty: number; // >= 1
  unitPrice: number; // >= 0
  lineTotal: number; // round2(unitPrice * qty) — stored, never re-derived
}

/**
 * A "course" (shopping trip) captured by scanning product barcodes.
 * A completed session IS its bill — the bill is a deterministic render of
 * this document, not a separate record.
 */
export interface CourseSession {
  id: string;
  status: SessionStatus;
  startedAt: string; // ISO timestamp
  endedAt?: string; // ISO timestamp, set on completion
  date: string; // YYYY-MM-DD (the trip)
  currency: string; // profile currency snapshot
  place: MoneyPlace; // where it was paid from
  items: SessionItem[]; // capped at 500 lines
  total: number; // denormalized sum of lineTotals
  loggedExpenseId?: string; // set once the total is logged as a variable expense
  loggedMonthKey?: string;
  loggedWorkspace?: 'personal' | 'household';
  loggedWorkspaceId?: string;
  loggedMutationId?: string;
  loggedAt?: string;
}
