/**
 * Insights — pure, unit-tested computations behind the Pro "smart" features:
 * safe-to-spend, month-end forecast, debt payoff planning, savings goal ETA,
 * net worth and free-history gating. Nothing here touches React, Firebase or
 * the DOM; every function is deterministic given `today`.
 */
import {
  type DebtItem,
  type MonthBudget,
  type SavingGoal,
  calculateEnvelopeAmounts,
  calculateEnvelopeSpent,
  calculateReceivedIncome,
  debtOutstanding,
  fixedPaidAmount,
  money,
  totalCashOnHand,
} from './store';

const DAY_MS = 86_400_000;

/** `money()` rejects negatives; projections and net worth legitimately can be. */
function signedMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Free plan may browse the current period plus this many previous ones. */
export const FREE_HISTORY_MONTHS = 3;
/** Free plan may create up to this many variable categories. */
export const FREE_CATEGORY_LIMIT = 10;

function parseIsoDay(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function utcDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Period window of a month in UTC day timestamps (falls back to calendar month). */
export function periodWindow(
  month: Pick<MonthBudget, 'periodStartDate' | 'periodEndDate' | 'periodKey'>,
  monthKey?: string,
): { start: number; end: number } {
  const start = parseIsoDay(month.periodStartDate);
  const end = parseIsoDay(month.periodEndDate);
  if (start && end) return { start: start.getTime(), end: end.getTime() };
  const key = month.periodKey || monthKey;
  const [y, m] = (key || '').split('-').map(Number);
  if (y && m) {
    return {
      start: Date.UTC(y, m - 1, 1),
      end: Date.UTC(y, m, 0),
    };
  }
  const now = new Date();
  return {
    start: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    end: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  };
}

export interface SafeToSpend {
  /** Needs+wants envelope still unspent (never negative). */
  remainingBudget: number;
  /** Planned/partial fixed bills still to be paid this period. */
  upcomingFixed: number;
  /** remainingBudget − upcomingFixed, floored at 0: what is really free. */
  discretionary: number;
  /** Days left in the period including today (≥ 1). */
  daysLeft: number;
  /** Total days in the period. */
  daysTotal: number;
  /** Discretionary / daysLeft. */
  perDay: number;
  /** Average spend per elapsed day so far. */
  burnRate: number;
  /** Projected total needs+wants spend at period end at the current burn rate + unpaid bills. */
  projectedSpend: number;
  /** Envelope budget (needs + wants) for the period. */
  budget: number;
  /** Projected leftover at period end (may be negative). */
  projectedLeftover: number;
  /** 'ok' | 'tight' | 'over' — simple traffic light for the card. */
  status: 'ok' | 'tight' | 'over';
}

/**
 * "How much can I spend per day until payday?" — the number people open a
 * budget app for. Uses the needs+wants envelopes of the strategy as the
 * spending budget, subtracts what already left and what is still committed
 * (unpaid fixed bills), and spreads the rest across the remaining days.
 */
export function calculateSafeToSpend(month: MonthBudget, today: Date = new Date()): SafeToSpend {
  const { needs, wants } = calculateEnvelopeAmounts(month.totalBudget || 0, month.strategyId, month.customRatios);
  const budget = money(needs + wants);
  const spent = calculateEnvelopeSpent(month).totalSpent;

  const upcomingFixed = money(
    (month.fixedExpenses || [])
      .filter((bill) => bill.status === 'planned' || bill.status === 'partial')
      .reduce((sum, bill) => sum + Math.max(0, bill.amount - fixedPaidAmount(bill)), 0),
  );

  const { start, end } = periodWindow(month);
  const now = utcDay(today);
  const daysTotal = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
  const clampedNow = Math.min(Math.max(now, start), end);
  const daysElapsed = Math.max(1, Math.round((clampedNow - start) / DAY_MS) + 1);
  const daysLeft = Math.max(1, daysTotal - daysElapsed + 1);

  const remainingBudget = money(Math.max(0, budget - spent));
  const discretionary = money(Math.max(0, remainingBudget - upcomingFixed));
  const perDay = money(discretionary / daysLeft);
  const burnRate = money(spent / daysElapsed);
  // Fixed bills are lumpy, not a daily burn: project variable spending by
  // rate, and add the committed bills on top.
  const variableSpent = (month.variableExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  const variableRate = variableSpent / daysElapsed;
  const projectedSpend = money(spent + variableRate * (daysLeft - 1) + upcomingFixed);
  const projectedLeftover = signedMoney(budget - projectedSpend);

  let status: SafeToSpend['status'] = 'ok';
  if (budget > 0 && projectedLeftover < 0) status = 'over';
  else if (budget > 0 && projectedLeftover < budget * 0.05) status = 'tight';

  return {
    remainingBudget,
    upcomingFixed,
    discretionary,
    daysLeft,
    daysTotal,
    perDay,
    burnRate,
    projectedSpend,
    budget,
    projectedLeftover,
    status,
  };
}


/* ------------------------------------------------------------------------ */
/* Debt payoff planner                                                       */
/* ------------------------------------------------------------------------ */

export type PayoffMethod = 'snowball' | 'avalanche';

export interface PayoffStep {
  debtId: string;
  name: string;
  outstanding: number;
  /** 1-based month index at which this debt reaches zero. */
  paidOffInMonths: number;
  /** ISO date (YYYY-MM-01) of the payoff month. */
  paidOffOn: string;
}

export interface PayoffPlan {
  method: PayoffMethod;
  monthlyBudget: number;
  totalOutstanding: number;
  /** Months until every debt is cleared; null when the budget is 0. */
  monthsToDebtFree: number | null;
  debtFreeOn: string | null;
  steps: PayoffStep[];
}

/**
 * Simple snowball (smallest balance first) / avalanche (highest balance first
 * — no interest data is tracked, so balance stands in for rate) rollover
 * plan. Each month the whole budget goes to the focus debt; when it clears,
 * the freed amount rolls to the next one. Bounded at 600 months.
 */
export function planDebtPayoff(
  debts: DebtItem[],
  monthlyBudget: number,
  method: PayoffMethod = 'snowball',
  today: Date = new Date(),
): PayoffPlan {
  const open = debts
    .filter((debt) => debt.type === 'debt' && debt.status === 'open' && debtOutstanding(debt) > 0)
    .map((debt) => ({ id: debt.id, name: debt.name, outstanding: debtOutstanding(debt) }));
  const totalOutstanding = money(open.reduce((sum, d) => sum + d.outstanding, 0));
  const budget = Number.isFinite(monthlyBudget) && monthlyBudget > 0 ? money(monthlyBudget) : 0;

  const ordered = [...open].sort((a, b) =>
    method === 'snowball' ? a.outstanding - b.outstanding : b.outstanding - a.outstanding,
  );

  const steps: PayoffStep[] = [];
  if (budget <= 0 || ordered.length === 0) {
    return { method, monthlyBudget: budget, totalOutstanding, monthsToDebtFree: null, debtFreeOn: null, steps };
  }

  const balances = ordered.map((d) => d.outstanding);
  let monthIndex = 0;
  const base = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  const monthLabel = (offset: number) => {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
    return d.toISOString().slice(0, 10);
  };

  while (monthIndex < 600 && balances.some((b) => b > 0)) {
    monthIndex += 1;
    let available = budget;
    for (let i = 0; i < balances.length && available > 0; i += 1) {
      if (balances[i] <= 0) continue;
      const payment = Math.min(balances[i], available);
      balances[i] = money(balances[i] - payment);
      available = money(available - payment);
      if (balances[i] <= 0) {
        steps.push({
          debtId: ordered[i].id,
          name: ordered[i].name,
          outstanding: ordered[i].outstanding,
          paidOffInMonths: monthIndex,
          paidOffOn: monthLabel(monthIndex),
        });
      }
    }
  }

  const done = balances.every((b) => b <= 0);
  return {
    method,
    monthlyBudget: budget,
    totalOutstanding,
    monthsToDebtFree: done ? monthIndex : null,
    debtFreeOn: done ? monthLabel(monthIndex) : null,
    steps,
  };
}

/* ------------------------------------------------------------------------ */
/* Savings goal projection                                                   */
/* ------------------------------------------------------------------------ */

export interface GoalProjection {
  remaining: number;
  /** Average monthly deposit observed (from `monthlyDeposits`). */
  monthlyPace: number;
  /** Months needed at the current pace; null when pace is 0 or goal is done. */
  monthsToTarget: number | null;
  /** ISO date (YYYY-MM-01) when the goal is expected to be reached. */
  reachedOn: string | null;
  /** Deposit required per month to hit `targetDate` (when provided). */
  requiredPerMonth: number | null;
  done: boolean;
}

/**
 * Project when a goal is reached given the deposits logged in the last
 * few months. `monthlyDeposits` are per-month net deposits, most recent
 * last; only the trailing 3 months are averaged so a pace change is felt
 * quickly.
 */
export function projectSavingsGoal(
  goal: Pick<SavingGoal, 'target' | 'current'>,
  monthlyDeposits: number[],
  today: Date = new Date(),
  targetDate?: string,
): GoalProjection {
  const remaining = money(Math.max(0, (goal.target || 0) - (goal.current || 0)));
  const done = remaining <= 0;
  const recent = monthlyDeposits.slice(-3).filter((v) => Number.isFinite(v) && v >= 0);
  const monthlyPace = recent.length ? money(recent.reduce((s, v) => s + v, 0) / recent.length) : 0;

  let monthsToTarget: number | null = null;
  let reachedOn: string | null = null;
  if (!done && monthlyPace > 0) {
    monthsToTarget = Math.ceil(remaining / monthlyPace);
    const d = new Date(Date.UTC(today.getFullYear(), today.getMonth() + monthsToTarget, 1));
    reachedOn = d.toISOString().slice(0, 10);
  }

  let requiredPerMonth: number | null = null;
  const target = parseIsoDay(targetDate);
  if (!done && target) {
    const months = Math.max(
      1,
      (target.getUTCFullYear() - today.getFullYear()) * 12 + (target.getUTCMonth() - today.getMonth()),
    );
    requiredPerMonth = money(remaining / months);
  }

  return { remaining, monthlyPace, monthsToTarget, reachedOn, requiredPerMonth, done };
}

/* ------------------------------------------------------------------------ */
/* Net worth                                                                 */
/* ------------------------------------------------------------------------ */

export interface NetWorthSnapshot {
  cash: number;
  savings: number;
  owedToMe: number;
  iOwe: number;
  assets: number;
  liabilities: number;
  net: number;
}

/** Cash on hand + savings + credits owed to me − open debts I owe. */
export function calculateNetWorth(month: MonthBudget, goals: SavingGoal[]): NetWorthSnapshot {
  const cash = money(Math.max(0, totalCashOnHand(month)));
  const savings = money(goals.reduce((sum, g) => sum + Math.max(0, g.current || 0), 0));
  let owedToMe = 0;
  let iOwe = 0;
  for (const debt of month.debts || []) {
    if (debt.status !== 'open') continue;
    const outstanding = debtOutstanding(debt);
    if (debt.type === 'credit') owedToMe += outstanding;
    else iOwe += outstanding;
  }
  const assets = money(cash + savings + owedToMe);
  const liabilities = money(iOwe);
  return {
    cash,
    savings,
    owedToMe: money(owedToMe),
    iOwe: money(iOwe),
    assets,
    liabilities,
    net: signedMoney(assets - liabilities),
  };
}

/* ------------------------------------------------------------------------ */
/* Free-history gate                                                         */
/* ------------------------------------------------------------------------ */

function monthOrdinal(key: string): number | null {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return y * 12 + (m - 1);
}

/**
 * Whether `targetKey` is browsable on the free plan: the current period and
 * the `limit` periods before it. Future months are always allowed (planning
 * ahead is free).
 */
export function isWithinFreeHistory(targetKey: string, currentKey: string, limit = FREE_HISTORY_MONTHS): boolean {
  const target = monthOrdinal(targetKey);
  const current = monthOrdinal(currentKey);
  if (target === null || current === null) return true;
  return current - target <= limit;
}

/* ------------------------------------------------------------------------ */
/* Merchant → category suggestion                                            */
/* ------------------------------------------------------------------------ */

function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Suggest a category for a new expense from what the user picked before for
 * the same (or a very similar) merchant name. Exact normalized match wins,
 * then a prefix / token overlap. Returns null when there is no history.
 */
export function suggestCategory(
  name: string,
  history: Array<{ name: string; type: string }>,
): string | null {
  const needle = normalizeMerchant(name);
  if (needle.length < 2) return null;
  const votes = new Map<string, number>();
  const needleTokens = new Set(needle.split(' '));
  for (const item of history) {
    const hay = normalizeMerchant(item.name || '');
    if (!hay) continue;
    let weight = 0;
    if (hay === needle) weight = 3;
    else if (hay.startsWith(needle) || needle.startsWith(hay)) weight = 2;
    else {
      const overlap = hay.split(' ').filter((tok) => tok.length > 2 && needleTokens.has(tok)).length;
      if (overlap > 0) weight = 1;
    }
    if (weight > 0) votes.set(item.type, (votes.get(item.type) || 0) + weight);
  }
  let best: string | null = null;
  let bestScore = 0;
  for (const [type, score] of votes) {
    if (score > bestScore) {
      best = type;
      bestScore = score;
    }
  }
  return best;
}

/* ------------------------------------------------------------------------ */
/* Global search                                                             */
/* ------------------------------------------------------------------------ */

export interface SearchHit {
  monthKey: string;
  kind: 'variable' | 'fixed' | 'debt';
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string;
  tags: string[];
}

/** Case/diacritic-insensitive search across months by name, category, note or #tag. */
export function searchTransactions(
  months: Array<{ monthKey: string; month: MonthBudget }>,
  query: string,
  limit = 200,
): SearchHit[] {
  const raw = query.trim();
  if (!raw) return [];
  const tagOnly = raw.startsWith('#') ? normalizeMerchant(raw.slice(1)) : null;
  const needle = normalizeMerchant(raw);
  const hits: SearchHit[] = [];
  const matches = (fields: string[], tags: string[]) => {
    if (tagOnly !== null) return tags.some((t) => normalizeMerchant(t) === tagOnly);
    return fields.some((f) => normalizeMerchant(f).includes(needle));
  };
  for (const { monthKey, month } of months) {
    for (const e of month.variableExpenses || []) {
      const tags = e.tags || [];
      if (matches([e.name, e.type, e.note || '', ...tags], tags)) {
        hits.push({ monthKey, kind: 'variable', id: e.id, name: e.name, amount: e.amount, date: e.date, category: e.type, tags });
      }
    }
    for (const b of month.fixedExpenses || []) {
      if (matches([b.name, b.type], [])) {
        hits.push({ monthKey, kind: 'fixed', id: b.id, name: b.name, amount: b.amount, date: b.date || `${monthKey}-01`, category: b.type, tags: [] });
      }
    }
    for (const d of month.debts || []) {
      if (matches([d.name, d.note || ''], [])) {
        hits.push({ monthKey, kind: 'debt', id: d.id, name: d.name, amount: d.amount, date: d.date, category: d.type, tags: [] });
      }
    }
    if (hits.length >= limit) break;
  }
  return hits.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

/** Received income − needs/wants spend for a month (signed). */
export function monthNetFlow(month: MonthBudget): number {
  return signedMoney(calculateReceivedIncome(month) - calculateEnvelopeSpent(month).totalSpent);
}
