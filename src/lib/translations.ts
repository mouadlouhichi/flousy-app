import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';

export type Language = 'en' | 'fr' | 'ar';

export const LOCALES: Language[] = ['en', 'fr', 'ar'];

export const LOCALE_NAMES: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
};

export const RTL_LOCALES: Language[] = ['ar'];

export type Messages = typeof en;

export const MESSAGES: Record<Language, Messages> = {
  en,
  fr: fr as unknown as Messages,
  ar: ar as unknown as Messages,
};

/** Simple interpolation: replaces {key} tokens. */
export function interpolate(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return key in values ? String(values[key]) : `{${key}}`;
  });
}

/** ICU plural resolver for {count, plural, ...} patterns. */
export function resolvePlural(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(
    /\{(\w+),\s*plural,\s*((?:[^{}]|\{[^}]*\})*)\}/g,
    (_, varName, cases) => {
      const count = Number(values[varName] || 0);
      const parsed: Record<string, string> = {};
      const caseRegex = /(?:=(\d+)|(\w+))\s*\{([^}]*)\}/g;
      let match: RegExpExecArray | null;
      while ((match = caseRegex.exec(cases)) !== null) {
        const key = match[1] !== undefined ? `=${match[1]}` : match[2];
        parsed[key] = match[3];
      }
      let result = parsed[`=${count}`];
      if (result === undefined) {
        if (count === 1 && parsed.one) result = parsed.one;
        else if (count === 2 && parsed.two) result = parsed.two;
        else if (count >= 3 && count <= 10 && parsed.few) result = parsed.few;
        else if (count >= 11 && count <= 99 && parsed.many) result = parsed.many;
        else result = parsed.other || '';
      }
      return result.replace(/#/g, String(count));
    }
  );
}

/** Full message formatter: resolves plurals then interpolates. */
export function formatMessage(template: string, values: Record<string, string | number> = {}): string {
  const withPlurals = resolvePlural(template, values);
  return interpolate(withPlurals, values);
}

/** Locale-aware number locale string for Intl APIs. */
export function getIntlLocale(language: Language): string {
  switch (language) {
    case 'ar': return 'ar-MA';
    case 'fr': return 'fr-FR';
    case 'en': default: return 'en-US';
  }
}

export interface CategoryPreset { name: string; color: string; icon: string; }

export function getDefaultCategories(language: Language): CategoryPreset[] {
  const msgs = MESSAGES[language];
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
