import { MonthBudget, normalizeMonth, type MonthConfiguration } from './store';

/** Last budget month the user was viewing (YYYY-MM). */
export const CURRENT_MONTH_STORAGE_KEY = 'flousy_current_month';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function isMonthKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredMonthKey(storage?: StorageLike | null): string | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    const value = store.getItem(CURRENT_MONTH_STORAGE_KEY);
    return isMonthKey(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredMonthKey(key: string, storage?: StorageLike | null): void {
  if (!isMonthKey(key)) return;
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(CURRENT_MONTH_STORAGE_KEY, key);
  } catch {
    /* quota / private mode */
  }
}

/**
 * Last ACTIVE salary period per workspace context (`flousy_active_period_*`).
 *
 * `readStoredMonthKey` remembers the month the user was *viewing* (so tab
 * navigation does not snap back to today), which is a different fact from the
 * period that was *active* the last time the app ran. This tracker records the
 * latter, so a payday that passed while the app was closed (or backgrounded)
 * can be detected as a rollover — and the dashboard can jump to the fresh
 * period and announce it, instead of silently re-opening last month's budget.
 */
const ACTIVE_PERIOD_STORAGE_PREFIX = 'flousy_active_period_';

export function readActivePeriod(contextKey: string, storage?: StorageLike | null): string | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    const value = store.getItem(`${ACTIVE_PERIOD_STORAGE_PREFIX}${contextKey}`);
    return isMonthKey(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeActivePeriod(contextKey: string, key: string, storage?: StorageLike | null): void {
  if (!isMonthKey(key)) return;
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(`${ACTIVE_PERIOD_STORAGE_PREFIX}${contextKey}`, key);
  } catch {
    /* quota / private mode */
  }
}

/**
 * Record the currently active period and report whether a NEW salary period
 * has started since the previous visit for this workspace context.
 *
 * Returns true only when a previously recorded period exists and the resolved
 * period is strictly newer (YYYY-MM compares lexicographically in date order).
 * First visits record silently: announcing "new period" to someone who just
 * signed up — or just installed this feature — would be noise.
 */
export function detectPeriodRollover(
  contextKey: string,
  resolvedKey: string,
  storage?: StorageLike | null,
): boolean {
  if (!isMonthKey(resolvedKey)) return false;
  const previous = readActivePeriod(contextKey, storage);
  writeActivePeriod(contextKey, resolvedKey, storage);
  return previous !== null && previous < resolvedKey;
}

export function readCachedMonth(
  storageKey: string,
  monthKey: string,
  profile?: MonthConfiguration | null,
  storage?: StorageLike | null,
): MonthBudget | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(storageKey);
    if (!raw) return null;
    return normalizeMonth(JSON.parse(raw), monthKey, profile ?? undefined);
  } catch {
    return null;
  }
}

export function writeCachedMonth(
  storageKey: string,
  month: MonthBudget,
  storage?: StorageLike | null,
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(storageKey, JSON.stringify(month));
  } catch {
    /* quota / private mode */
  }
}
