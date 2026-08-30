/**
 * Lightweight i18n utilities — no Firebase, no React context, no full
 * translation bundle. Safe to use from server components, client components,
 * and static pages.
 *
 * NOTE: `fr`/`ar` JSON are intentionally NOT imported here. They are loaded
 * lazily via `./messages` (see `loadMessages`) so static/public bundles keep
 * only the English dictionary.
 */

import {
  type Language,
  type Messages,
  EN_MESSAGES,
  LOCALES,
  LOCALE_NAMES,
  RTL_LOCALES,
  isRTL,
  formatMessage,
  getIntlLocale,
} from './i18n-core';

export {
  type Language,
  type Messages,
  EN_MESSAGES,
  LOCALES,
  LOCALE_NAMES,
  RTL_LOCALES,
  isRTL,
  formatMessage,
  getIntlLocale,
};

export const LANG_COOKIE = 'flousy_language';
export const LANG_STORAGE_KEY = 'flousy_language';

export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const browserLangs = navigator.languages || [navigator.language];
  for (const lang of browserLangs) {
    const code = lang.split('-')[0].toLowerCase();
    if (LOCALES.includes(code as Language)) return code as Language;
  }
  return 'en';
}

export function getLocaleFromCookieString(cookieStr: string): Language | null {
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]+)`));
  if (match && LOCALES.includes(match[1] as Language)) return match[1] as Language;
  return null;
}

export function setLanguageCookie(locale: Language): void {
  document.cookie = `${LANG_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

export function resolveClientLocale(): Language {
  if (typeof document !== 'undefined') {
    const fromCookie = getLocaleFromCookieString(document.cookie);
    if (fromCookie) return fromCookie;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (LOCALES.includes(stored as Language)) return stored as Language;
    } catch { /* ignore */ }
  }
  return detectBrowserLanguage();
}
