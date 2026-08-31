/**
 * i18n core — pure formatting logic and locale metadata.
 *
 * IMPORTANT (performance): this module statically imports ONLY the English
 * message file. French and Arabic message JSON are loaded on demand
 * (see ./messages), so the marketing/public bundle no longer ships all
 * three translations (previously ~136 KB of JSON) to every visitor.
 */
import en from '../../messages/en.json';

export type Language = 'en' | 'fr' | 'ar';
export type Messages = typeof en;

export const EN_MESSAGES: Messages = en;

export const LOCALES: Language[] = ['en', 'fr', 'ar'];

export const LOCALE_NAMES: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
};

export const RTL_LOCALES: Language[] = ['ar'];

export function isValidLocale(v: unknown): v is Language {
  return typeof v === 'string' && LOCALES.includes(v as Language);
}

export function isRTL(locale: Language): boolean {
  return RTL_LOCALES.includes(locale);
}

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

/**
 * Resolve a dot-separated message path (for example `tabs.fixed.addCharge`).
 * Keeping this here lets feature components use a readable key without
 * importing every locale file or falling back to hard-coded English copy.
 */
export function getMessage(messages: Messages, path: string): string {
  const value = path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, messages);

  return typeof value === 'string' ? value : path;
}

/** Resolve and format one translated message by path. */
export function translateMessage(
  messages: Messages,
  path: string,
  values: Record<string, string | number> = {},
): string {
  return formatMessage(getMessage(messages, path), values);
}

/** Locale-aware number locale string for Intl APIs. */
export function getIntlLocale(language: Language): string {
  switch (language) {
    case 'ar': return 'ar-MA';
    case 'fr': return 'fr-FR';
    case 'en': default: return 'en-US';
  }
}
