/**
 * Lightweight i18n utilities — no Firebase, no React context.
 * Safe to use from server components, client components, and static pages.
 */

import {
  type Language,
  type Messages,
  MESSAGES,
  LOCALES,
  LOCALE_NAMES,
  RTL_LOCALES,
  formatMessage,
} from './translations';

export { type Language, type Messages, LOCALES, LOCALE_NAMES, RTL_LOCALES, formatMessage };
export { MESSAGES };

export const LANG_COOKIE = 'flousy_language';
export const LANG_STORAGE_KEY = 'flousy_language';

export function isValidLocale(v: unknown): v is Language {
  return typeof v === 'string' && LOCALES.includes(v as Language);
}

export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const browserLangs = navigator.languages || [navigator.language];
  for (const lang of browserLangs) {
    const code = lang.split('-')[0].toLowerCase();
    if (isValidLocale(code)) return code;
  }
  return 'en';
}

export function getLocaleFromCookieString(cookieStr: string): Language | null {
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]+)`));
  if (match && isValidLocale(match[1])) return match[1] as Language;
  return null;
}

export function getMessages(locale: Language): Messages {
  return MESSAGES[locale] || MESSAGES.en;
}

export function isRTL(locale: Language): boolean {
  return RTL_LOCALES.includes(locale);
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
      if (isValidLocale(stored)) return stored;
    } catch { /* ignore */ }
  }
  return detectBrowserLanguage();
}
