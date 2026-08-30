import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({
  id: 'flousy-mobile-storage',
});

export const DEMO_MODE_KEY = 'flousy_demo_mode';
export const DEMO_DATA_KEY_PREFIX = 'flousy_demo_month_';
export const DEMO_SAVINGS_KEY = 'flousy_demo_savings';
export const DEMO_PROFILE_KEY = 'flousy_demo_profile';
export const DEMO_PRODUCTS_KEY = 'flousy_demo_products';
export const DEMO_SESSIONS_KEY = 'flousy_demo_sessions';
export const LANG_STORAGE_KEY = 'flousy_language';
export const CURRENCY_STORAGE_KEY = 'flousy_currency';
export const PRO_PLAN_KEY = 'flousy_pro_plan';

export function isDemoMode(): boolean {
  return storage.getBoolean(DEMO_MODE_KEY) ?? false;
}

export function setDemoMode(val: boolean): void {
  storage.set(DEMO_MODE_KEY, val);
}

export function getDemoMonthData(monthId: string): string | undefined {
  return storage.getString(`${DEMO_DATA_KEY_PREFIX}${monthId}`);
}

export function saveDemoMonthData(monthId: string, json: string): void {
  storage.set(`${DEMO_DATA_KEY_PREFIX}${monthId}`, json);
}

export function getDemoSavingsData(): string | undefined {
  return storage.getString(DEMO_SAVINGS_KEY);
}

export function saveDemoSavingsData(json: string): void {
  storage.set(DEMO_SAVINGS_KEY, json);
}

export function getJson<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJson(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

export function clearDemoData(): void {
  storage.delete(DEMO_MODE_KEY);
  storage.delete(DEMO_SAVINGS_KEY);
  storage.delete(DEMO_PROFILE_KEY);
  storage.delete(DEMO_PRODUCTS_KEY);
  storage.delete(DEMO_SESSIONS_KEY);
  storage.delete(PRO_PLAN_KEY);
  const keys = storage.getAllKeys();
  for (const key of keys) {
    if (key.startsWith(DEMO_DATA_KEY_PREFIX)) {
      storage.delete(key);
    }
  }
}
