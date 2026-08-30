import { MonthBudget, UserProfile, normalizeMonth } from './store';

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

export function readCachedMonth(
  storageKey: string,
  monthKey: string,
  profile?: UserProfile | null,
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
