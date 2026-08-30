import type { MoneyPlace } from './store';

/** Human labels for the three tracked money places. */
export const MONEY_PLACE_LABELS: Record<MoneyPlace, string> = {
  bank: 'Bank',
  wallet: 'Wallet',
  home: 'Home Cash',
};

export type PlaceBalances = Partial<Record<MoneyPlace, number>>;

/** An entry that is about to be replaced, whose money is put back first. */
export interface RefundableEntry {
  place?: MoneyPlace | null;
  amount?: number;
}

/**
 * How much money can actually be spent from `place`.
 *
 * Returns `null` when the caller has no balances to check against (the
 * component is used standalone), which disables the check instead of
 * pretending every place is empty.
 *
 * When `refund` is given and it was taken from the same place, its amount is
 * added back first: editing an entry refunds the old movement before the new
 * one is debited, so a user can always re-save an entry unchanged.
 */
export function getAvailableBalance(
  balances: PlaceBalances | undefined | null,
  place: MoneyPlace,
  refund?: RefundableEntry | null,
): number | null {
  if (!balances) return null;

  const base = Number.isFinite(balances[place]) ? Number(balances[place]) : 0;

  if (!refund || refund.place !== place) return base;

  const refunded = Number.isFinite(refund.amount) ? Number(refund.amount) : 0;
  return base + Math.max(0, refunded);
}

/**
 * Error message when `amount` is more than `available`, otherwise `null`.
 * Amounts are compared with a small epsilon so floating-point dust
 * (e.g. 0.1 + 0.2) never blocks a legitimate save.
 */
export function insufficientFundsMessage(
  amount: number,
  available: number,
  place: MoneyPlace,
  format: (value: number) => string,
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (amount <= available + 1e-6) return null;

  return `Not enough money in ${MONEY_PLACE_LABELS[place]}. Available: ${format(available)}`;
}
