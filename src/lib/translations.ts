/**
 * Compatibility re-exports for translation utilities.
 *
 * The heavy per-locale JSON imports moved to `./i18n-core` (English only) and
 * `./messages` (lazy FR/AR) so bundles no longer carry all three languages.
 */
export {
  type Language,
  type Messages,
  LOCALES,
  LOCALE_NAMES,
  RTL_LOCALES,
  EN_MESSAGES,
  isRTL,
  formatMessage,
  getIntlLocale,
} from './i18n-core';

export {
  loadMessages,
  getDefaultCategories,
  getDefaultCategoryNames,
} from './messages';
