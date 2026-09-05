/**
 * Per money-source transaction ledger ("bank history").
 *
 * A month document keeps several independently-capped records that all move
 * cash between money places:
 *
 *   - variable expenses   (paid from `expense.place`)
 *   - fixed bills paid    (paid from `bill.place`, amount = paid part)
 *   - income received     (credits the bank, the only place income enters)
 *   - money transfers     (`transfers`: from/to a place)
 *   - savings deposits / withdrawals (`savingsActivity`: place is where the
 *     money was taken from / paid back into)
 *   - balance corrections (`balanceAdjustments`: reconciliation, opening
 *     balance, income)
 *
 * This module flattens every record touching ONE place into a single,
 * newest-first statement with a running balance, the way a bank shows it.
 *
 * Ordering: `addVariableExpense`, `moveMoney`, … all prepend, so each source
 * array is already newest-first. The builder therefore walks them in reverse
 * (oldest → newest) and then reverses for display, which makes rows of the
 * same day (and same unknown intra-day time) follow the same recency order the
 * rest of the app shows.
 *
 * Balances are derived: `openingBalance` is the place's balance at the start of
 * the period reconstructed from its *current* balance and this period's
 * recorded movements (`current − Σ deltas`), so the newest row always shows the
 * exact balance displayed on the money card. Movements that were never logged
 * as a record (e.g. editing an income line mid-period, deleting a goal whose
 * funds are refunded) are absorbed into the opening balance; the statement
 * still reconciles exactly.
 */

import type {
  BalanceAdjustment,
  MoneyPlace,
  MonthBudget,
  SavingsActivityEntry,
} from './store';

export type PlaceLedgerKind =
  | 'expense'
  | 'bill'
  | 'income'
  | 'transfer'
  | 'savings'
  | 'adjustment';

export interface PlaceLedgerRow {
  /** Deterministic, unique within a statement. */
  id: string;
  kind: PlaceLedgerKind;
  /** Signed: negative money left the place, positive entered it. */
  delta: number;
  /** Calendar day (YYYY-MM-DD) the movement is attributed to. */
  day: string;
  /** Exact ISO instant when the movement was recorded (absent = day precision only). */
  instant?: string;
  /** Balance immediately after this movement (index 0 = the current balance). */
  balance: number;
  /** Primary label source (merchant / bill / income / goal name). */
  name: string;
  /** Expense / bill category. */
  type?: string;
  from?: MoneyPlace;
  to?: MoneyPlace;
  note?: string;
  reason?: BalanceAdjustment['reason'];
  activityType?: SavingsActivityEntry['type'];
}

export interface PlaceLedger {
  place: MoneyPlace;
  currentBalance: number;
  openingBalance: number;
  /** Newest movement first. */
  rows: PlaceLedgerRow[];
}

export interface PlaceLedgerOptions {
  /**
   * Which record kinds may appear. The Overview only opens the statement for
   * members who may see the place balance, but a household member may still
   * not be allowed to see the *amounts* of, say, expense lines — those rows
   * are then excluded and the reconstructed opening absorbs them.
   */
  include?: {
    expenses?: boolean;
    fixedBills?: boolean;
    income?: boolean;
    savings?: boolean;
  };
}

type LedgerMonth = Pick<
  MonthBudget,
  | 'bankPart'
  | 'homePart'
  | 'walletPart'
  | 'placeBalances'
  | 'periodStartDate'
  | 'variableExpenses'
  | 'fixedExpenses'
  | 'transfers'
  | 'balanceAdjustments'
  | 'savingsActivity'
  | 'incomeSources'
>;

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** Accept a day key only when it is a real YYYY-MM-DD; else fall back. */
function safeDay(value: string | undefined, fallback: string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return fallback;
}

/** Build the newest-first statement for one money place over one month. */
export function buildPlaceLedger(month: LedgerMonth, placeId: MoneyPlace, options: PlaceLedgerOptions = {}): PlaceLedger {
  const include = {
    expenses: options.include?.expenses !== false,
    fixedBills: options.include?.fixedBills !== false,
    income: options.include?.income !== false,
    savings: options.include?.savings !== false,
  };

  // Latest day this period could attribute a movement to when no exact date
  // exists on legacy rows (fixed bills whose due day is "1st"/"15th", …).
  const periodDay = safeDay(month.periodStartDate, '1970-01-01');

  // Every source array is newest-first (the writers prepend), so walking it in
  // reverse yields oldest→newest and keeps stable-sort ties chronological.
  // Balance is derived in a second pass, so drafts carry no balance yet.
  const oldestFirst: Array<Omit<PlaceLedgerRow, 'balance'>> = [];

  if (include.expenses) {
    for (const expense of [...(month.variableExpenses || [])].reverse()) {
      if ((expense.place || 'bank') !== placeId) continue;
      oldestFirst.push({
        id: `expense-${expense.id}`,
        kind: 'expense',
        delta: -round2(expense.amount),
        day: safeDay(expense.date, periodDay),
        name: expense.name,
        type: expense.type,
      });
    }
  }

  if (include.fixedBills) {
    for (const bill of [...(month.fixedExpenses || [])].reverse()) {
      if ((bill.place || 'bank') !== placeId) continue;
      const paid = round2(bill.paidAmount ?? 0);
      if (paid <= 0) continue; // planned bills never moved cash
      oldestFirst.push({
        id: `bill-${bill.id}`,
        kind: 'bill',
        delta: -paid,
        // Exact payment instant when the app recorded one; legacy rows only
        // know the due day ("1st") — those are attributed to the period start.
        instant: bill.paidAt,
        day: safeDay(bill.paidAt, safeDay(bill.date, periodDay)),
        name: bill.name,
        type: bill.type,
      });
    }
  }

  if (include.income && placeId === 'bank') {
    for (const source of [...(month.incomeSources || [])].reverse()) {
      const received = round2(source.receivedAmount ?? 0);
      if (received <= 0) continue;
      oldestFirst.push({
        id: `income-${source.id}`,
        kind: 'income',
        delta: received,
        instant: source.receivedAt,
        day: safeDay(source.receivedAt, periodDay),
        name: source.name,
      });
    }
  }

  for (const transfer of [...(month.transfers || [])].reverse()) {
    if (transfer.from === placeId) {
      oldestFirst.push({
        id: `transfer-out-${transfer.id}`,
        kind: 'transfer',
        delta: -round2(transfer.amount),
        instant: transfer.date,
        day: safeDay(transfer.date, periodDay),
        name: '',
        from: transfer.from,
        to: transfer.to,
      });
    } else if (transfer.to === placeId) {
      oldestFirst.push({
        id: `transfer-in-${transfer.id}`,
        kind: 'transfer',
        delta: round2(transfer.amount),
        instant: transfer.date,
        day: safeDay(transfer.date, periodDay),
        name: '',
        from: transfer.from,
        to: transfer.to,
      });
    }
  }

  for (const adjustment of [...(month.balanceAdjustments || [])].reverse()) {
    if (adjustment.place !== placeId) continue;
    const delta = round2(adjustment.delta);
    if (delta === 0) continue;
    oldestFirst.push({
      id: `adjustment-${adjustment.id}`,
      kind: 'adjustment',
      delta,
      instant: adjustment.date,
      day: safeDay(adjustment.date, periodDay),
      name: adjustment.note || '',
      reason: adjustment.reason,
    });
  }

  if (include.savings) {
    for (const entry of [...(month.savingsActivity || [])].reverse()) {
      // Older entries may omit the place; without it we cannot attribute the
      // movement to this source, so they are left out (the opening absorbs it).
      if (!entry.place || entry.place !== placeId) continue;
      oldestFirst.push({
        id: `savings-${entry.id}`,
        kind: 'savings',
        delta: round2(entry.type === 'deposit' ? -entry.amount : entry.amount),
        instant: entry.date,
        day: safeDay(entry.date, periodDay),
        name: entry.goalName,
        activityType: entry.type,
      });
    }
  }

  // Oldest → newest, so ties within a day keep the reversed-array order above.
  const chronological = oldestFirst.sort((a, b) => {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    const aTime = a.instant ?? `${a.day}T00:00:00.000Z`;
    const bTime = b.instant ?? `${b.day}T00:00:00.000Z`;
    if (aTime !== bTime) return aTime < bTime ? -1 : 1;
    return 0; // stable sort preserves construction order
  });

  // Newest first; walk newest → oldest so each row's balance is the running
  // balance right after it, ending (after the oldest) at the opening balance.
  let running = getLedgerBalance(month, placeId);
  const rows: PlaceLedgerRow[] = [...chronological].reverse().map((draft) => {
    const row: PlaceLedgerRow = { ...draft, balance: running };
    running = round2(running - draft.delta);
    return row;
  });

  return {
    place: placeId,
    currentBalance: getLedgerBalance(month, placeId),
    openingBalance: running,
    rows,
  };
}

/** Cash currently held at the place (mirrors `getPlaceBalance`). */
function getLedgerBalance(month: LedgerMonth, place: MoneyPlace): number {
  if (place === 'bank') return month.bankPart || 0;
  if (place === 'home') return month.homePart || 0;
  if (place === 'wallet') return month.walletPart || 0;
  return month.placeBalances?.[place] || 0;
}
