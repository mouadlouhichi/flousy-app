/**
 * Web app translations — re-exports from @flousy/core.
 * This avoids duplicating the message JSON files in the monorepo.
 */

export {
  type Language,
  type Messages,
  LOCALES,
  LOCALE_NAMES,
  RTL_LOCALES,
  MESSAGES,
  interpolate,
  resolvePlural,
  formatMessage,
  getIntlLocale,
  type CategoryPreset,
  getDefaultCategories,
  getDefaultCategoryNames,
} from '@flousy/core';
