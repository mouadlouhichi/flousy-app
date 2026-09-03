import {
  calculateTotalIncome,
  type DebtItem,
  type FixedExpense,
  type IncomeSource,
  type MonthBudget,
  type VariableExpense,
} from './store';

/**
 * On-demand workspace sync (personal ⇄ household), transactions only.
 *
 * Scope (by product decision, 2026-09-03):
 * - Records copied: incomes, variable expenses, fixed charges, debts.
 * - Never copied: money balances (bank/home/wallet/placeBalances),
 *   transfers, balance adjustments, savings activity and goals — those move
 *   cash between places or belong to a workspace's own savings plan, so
 *   copying them would double-count money.
 * - Merge semantics: records keep their original ids; a record whose id
 *   already exists in the target is skipped (the target's own version wins).
 *   Because ids survive the copy, running the same sync twice is a no-op.
 */

export interface WorkspaceSyncCounts {
  months: number;
  incomes: number;
  variableExpenses: number;
  fixedExpenses: number;
  debts: number;
}

export interface TransactionMergeCounts {
  incomes: number;
  variableExpenses: number;
  fixedExpenses: number;
  debts: number;
}

/**
 * Plan for aligning the two workspaces' budget-month start days before a
 * bidirectional sync. The reference ("source point") workspace keeps its
 * start day; the other workspace is overridden to match, so both sides map
 * period keys onto the same date ranges.
 */
export interface WorkspaceSyncAlignment {
  /** True when both workspaces already start the budget month on the same day. */
  aligned: boolean;
  /** Start day of the reference workspace — the value to apply. */
  day: number;
  /** Workspace whose monthStartDate must change (undefined when aligned). */
  target?: 'personal' | 'household';
}

export function planWorkspaceSyncAlignment(
  personalStartDay: number | undefined,
  householdStartDay: number | undefined,
  reference: 'personal' | 'household',
): WorkspaceSyncAlignment {
  const normalize = (value: number | undefined) =>
    Math.min(31, Math.max(1, Math.round(Number(value) || 1)));
  const personal = normalize(personalStartDay);
  const household = normalize(householdStartDay);
  if (personal === household) return { aligned: true, day: personal };
  return {
    aligned: false,
    day: reference === 'personal' ? personal : household,
    target: reference === 'personal' ? 'household' : 'personal',
  };
}

export function emptyWorkspaceSyncCounts(): WorkspaceSyncCounts {
  return { months: 0, incomes: 0, variableExpenses: 0, fixedExpenses: 0, debts: 0 };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Id-keyed union of one record collection. Existing target records are never
 * modified — the sync only appends what the target is missing, which is what
 * makes repeated runs idempotent and target-side edits authoritative.
 */
function mergeById<T extends { id: string }>(targetItems: T[], sourceItems: T[]): { items: T[]; added: number } {
  const existing = new Set(targetItems.map((item) => item.id));
  const appended = sourceItems.filter((item) => item.id && !existing.has(item.id));
  return {
    items: appended.length > 0 ? [...targetItems, ...appended] : targetItems,
    added: appended.length,
  };
}

/**
 * Zero-amount source records carry no information (normalizeMonth materializes
 * a zero "Primary Income" row for empty months) and would only pollute the
 * target with junk rows — they are dropped before merging.
 */
function meaningful<T extends { amount: number }>(items: T[] | undefined): T[] {
  return (items || []).filter((item) => item && typeof item.amount === 'number' && item.amount > 0);
}

/**
 * Merge one source month's transactions into the target month. Returns the
 * next target month plus per-type counts, or `null` when the target already
 * has every record (nothing to do — the caller skips the write entirely).
 *
 * Balances and every non-transaction field are passed through untouched.
 */
export function mergeSourceTransactionsIntoMonth(
  target: MonthBudget,
  source: MonthBudget,
): { month: MonthBudget; counts: TransactionMergeCounts } | null {
  const incomes = mergeById(target.incomeSources || [], meaningful(source.incomeSources) as IncomeSource[]);
  const variable = mergeById(target.variableExpenses || [], meaningful(source.variableExpenses) as VariableExpense[]);
  const fixed = mergeById(target.fixedExpenses || [], meaningful(source.fixedExpenses) as FixedExpense[]);
  const debts = mergeById(target.debts || [], meaningful(source.debts) as DebtItem[]);

  const counts: TransactionMergeCounts = {
    incomes: incomes.added,
    variableExpenses: variable.added,
    fixedExpenses: fixed.added,
    debts: debts.added,
  };
  const total = counts.incomes + counts.variableExpenses + counts.fixedExpenses + counts.debts;
  if (total === 0) return null;

  return {
    month: {
      ...target,
      incomeSources: incomes.items,
      variableExpenses: variable.items,
      fixedExpenses: fixed.items,
      debts: debts.items,
      // `totalBudget` is the declared expected income; keep it consistent with
      // the merged sources (calculateTotalIncome preserves a declared budget
      // when every source is zeroed). Only recalculated when incomes moved.
      ...(counts.incomes > 0
        ? { totalBudget: round2(calculateTotalIncome({ totalBudget: target.totalBudget, incomeSources: incomes.items })) }
        : {}),
    },
    counts,
  };
}
