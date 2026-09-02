import { formatLocalizedPercent, formatMessage, type Messages } from './i18n-core';
import type { StrategyId } from './store';

const CATEGORY_KEYS: Record<string, keyof Messages['categories']> = {
  food: 'food',
  'food & drink': 'food',
  groceries: 'groceries',
  transport: 'transport',
  transportation: 'transport',
  rent: 'rent',
  housing: 'housing',
  entertainment: 'entertainment',
  health: 'health',
  utilities: 'utilities',
  shopping: 'shopping',
  subscriptions: 'subscriptions',
  'dining out': 'diningOut',
  other: 'other',
};

const PERSON_KEYS = {
  Self: 'self',
  Me: 'self',
  Partner: 'partnerSpouse',
  Family: 'familyShared',
  Queen: 'queen',
  King: 'king',
} as const;

/** Translate built-in category labels while preserving user-created names. */
export function localizeCategoryName(name: string, messages: Messages): string {
  const key = CATEGORY_KEYS[name.trim().toLowerCase()];
  return key ? messages.categories[key] : name;
}

/** Translate a built-in cash-location name while preserving custom locations. */
export function localizePlaceName(
  id: string | undefined,
  fallbackName: string,
  messages: Messages,
): string {
  if (id === 'bank') return messages.places.bank;
  if (id === 'home') return messages.places.home;
  if (id === 'wallet') return messages.places.wallet;
  return fallbackName;
}

/** Translate the stored household-person presets without changing stored data. */
export function localizePersonName(name: string | undefined, messages: Messages): string {
  if (!name) return messages.modals.expense.self;
  const key = PERSON_KEYS[name as keyof typeof PERSON_KEYS];
  return key ? messages.modals.expense[key] : name;
}

export function localizeDebtStatus(status: 'open' | 'settled', messages: Messages): string {
  return status === 'settled' ? messages.common.settled : messages.common.open;
}

export function localizeHouseholdRole(role: string, messages: Messages): string {
  if (role === 'owner') return messages.householdRoles.owner;
  if (role === 'editor') return messages.householdRoles.editor;
  if (role === 'viewer') return messages.householdRoles.viewer;
  if (role === 'contributor') return messages.householdRoles.contributor;
  if (role === 'custom') return messages.householdRoles.custom;
  if (role === 'profile') return messages.householdRoles.profile;
  return role;
}

/** Translate the optional starter bill names without altering persisted names. */
export function localizeDefaultBillName(name: string, messages: Messages): string {
  if (name === 'Rent') return messages.onboarding.rent;
  if (name === 'Electricity') return messages.onboarding.electricity;
  return name;
}

/** Translate built-in income-source names while preserving user-created ones. */
export function localizeIncomeSourceName(name: string, messages: Messages): string {
  if (name === 'Primary Income') return messages.modals.incomeSources.primaryIncome;
  if (name === 'Carried over') return messages.modals.incomeSources.carriedOver;
  return name;
}

/** Translate built-in fixed-bill category values used during onboarding. */
export function localizeBillCategory(name: string, messages: Messages): string {
  const options = messages.onboarding.billCategoryOptions;
  const keys: Record<string, keyof typeof options> = {
    Housing: 'housing',
    Utilities: 'utilities',
    'Internet & Phone': 'internetPhone',
    Subscriptions: 'subscriptions',
    Insurance: 'insurance',
    Transport: 'transport',
    'Food & Groceries': 'foodGroceries',
    Health: 'health',
    Education: 'education',
    Childcare: 'childcare',
    Entertainment: 'entertainment',
    Loans: 'loans',
    Savings: 'savings',
    Other: 'other',
  };
  const key = keys[name];
  return key ? options[key] : localizeCategoryName(name, messages);
}

export function localizeStrategy(
  strategyId: StrategyId,
  messages: Messages,
  intlLocale = 'en-US',
) {
  const strategy = messages.strategies[strategyId];
  if (strategyId !== '50-30-20') return strategy;

  return {
    ...strategy,
    description: formatMessage(strategy.description, {
      needs: formatLocalizedPercent(50, intlLocale),
      wants: formatLocalizedPercent(30, intlLocale),
      savings: formatLocalizedPercent(20, intlLocale),
    }),
  };
}

/**
 * Format a recurring day-of-month naturally for the active interface locale.
 * Storage still uses its original value (for example "15th") elsewhere.
 */
export function formatLocalizedDayOfMonth(
  day: number,
  language: 'en' | 'fr' | 'ar',
  intlLocale: string,
): string {
  const safeDay = Math.min(31, Math.max(1, Math.round(day)));
  const number = new Intl.NumberFormat(intlLocale).format(safeDay);
  if (language === 'ar') return `${number} من الشهر`;
  if (language === 'fr') return `${number}${safeDay === 1 ? 'er' : ''}`;

  const mod10 = safeDay % 10;
  const mod100 = safeDay % 100;
  const suffix = mod10 === 1 && mod100 !== 11
    ? 'st'
    : mod10 === 2 && mod100 !== 12
      ? 'nd'
      : mod10 === 3 && mod100 !== 13
        ? 'rd'
        : 'th';
  return `${number}${suffix}`;
}
