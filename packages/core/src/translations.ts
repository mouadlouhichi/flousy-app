/**
 * Shared i18n API for web + mobile.
 * English is the source of truth; FR/AR are bundled so React Native can switch
 * locales without a network fetch.
 */
export {
  type Language,
  type Messages,
  LOCALES,
  LOCALE_NAMES,
  RTL_LOCALES,
  EN_MESSAGES,
  isValidLocale,
  isRTL,
  interpolate,
  resolvePlural,
  formatMessage,
  getIntlLocale,
} from './i18n-core';

import type { Language } from './i18n-core';
import en from '../messages/en.json';
import fr from '../messages/fr.json';
import ar from '../messages/ar.json';

export type MessagesAll = typeof en;

export const MESSAGES: Record<Language, MessagesAll> = {
  en,
  fr: fr as unknown as MessagesAll,
  ar: ar as unknown as MessagesAll,
};

export interface CategoryPreset { name: string; color: string; icon: string; }

export function getDefaultCategories(language: Language): CategoryPreset[] {
  const msgs = MESSAGES[language] || MESSAGES.en;
  return [
    { name: msgs.categories.food, color: '#f97316', icon: 'restaurant' },
    { name: msgs.categories.transport, color: '#3b82f6', icon: 'directions_car' },
    { name: msgs.categories.rent, color: '#8b5cf6', icon: 'home' },
    { name: msgs.categories.entertainment, color: '#ec4899', icon: 'sports_esports' },
    { name: msgs.categories.health, color: '#14b8a6', icon: 'favorite' },
    { name: msgs.categories.utilities, color: '#f59e0b', icon: 'bolt' },
    { name: msgs.categories.shopping, color: '#6366f1', icon: 'shopping_bag' },
    { name: msgs.categories.subscriptions, color: '#ef4444', icon: 'subscriptions' },
  ];
}

export function getDefaultCategoryNames(language: Language): string[] {
  return getDefaultCategories(language).map((c) => c.name);
}
