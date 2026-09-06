/**
 * Expense list ordering for the Variable tab.
 *
 * Expense dates are calendar-day strings (YYYY-MM-DD), so two expenses logged
 * on the same day cannot be told apart by date alone. The tab keeps its list in
 * `month.variableExpenses` with the most recently added entry first
 * (`addVariableExpense` prepends), which makes each entry's position in the
 * array its recency of addition. "Newest first" therefore breaks same-day ties
 * by that recency — a brand-new expense must land on top of its day instead of
 * being scattered by an alphabetical fallback — and "Oldest first" mirrors it.
 */

export type ExpenseSort = 'newest' | 'oldest' | 'amountHigh' | 'amountLow' | 'name';

export function sortVariableExpenses<T extends { date?: string; name: string; amount: number }>(
  expenses: readonly T[],
  mode: ExpenseSort,
  intlLocale?: string,
): T[] {
  return expenses
    .map((expense, index) => ({ expense, index }))
    .sort(({ expense: a, index: addedAfterA }, { expense: b, index: addedAfterB }) => {
      if (mode === 'amountHigh') return b.amount - a.amount;
      if (mode === 'amountLow') return a.amount - b.amount;
      if (mode === 'name') return a.name.localeCompare(b.name, intlLocale, { sensitivity: 'base' });
      const byDate = (a.date || '').localeCompare(b.date || '');
      if (mode === 'oldest') return byDate || addedAfterB - addedAfterA;
      // "newest": latest date first; same-day ties keep the list's recency
      // order (index 0 = added most recently), never a name fallback.
      return -byDate || addedAfterA - addedAfterB;
    })
    .map(({ expense }) => expense);
}
