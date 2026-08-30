/**
 * Per-locale message loading.
 *
 * Only `en.json` is bundled statically (via ./i18n-core) so the first paint
 * is never blocked on a network fetch; `fr.json` and `ar.json` are webpack
 * code-split into their own chunks and fetched the first time a user switches
 * to / lands in that locale.
 */
import { EN_MESSAGES, type Language, type Messages } from './i18n-core';

export type { Language, Messages };

export function loadMessages(locale: Language): Promise<Messages> {
  switch (locale) {
    case 'fr':
      return import('../../messages/fr.json').then((m) => m.default as unknown as Messages);
    case 'ar':
      return import('../../messages/ar.json').then((m) => m.default as unknown as Messages);
    case 'en':
    default:
      return Promise.resolve(EN_MESSAGES);
  }
}

export interface CategoryPreset { name: string; color: string; icon: string; }

/**
 * Default onboarding categories. These are intentionally resolved from the
 * built-in English messages: callers use them only as suggestion presets on
 * first setup, and the names are user-editable afterwards. Keeping this
 * function synchronous avoids waiting for a lazy locale chunk during
 * onboarding.
 */
export function getDefaultCategories(_language: Language): CategoryPreset[] {
  const msgs = EN_MESSAGES;
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
