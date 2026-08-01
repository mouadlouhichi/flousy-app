export interface Currency {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  digits: number;
}

export const SUPPORTED_CURRENCIES: Record<string, Currency> = {
  MAD: { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham', locale: 'fr-MA', digits: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'fr-FR', digits: 2 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', digits: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', digits: 2 },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA', digits: 2 },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH', digits: 2 },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham', locale: 'ar-AE', digits: 2 },
  SAR: { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', locale: 'ar-SA', digits: 2 },
  EGP: { code: 'EGP', symbol: 'EGP', name: 'Egyptian Pound', locale: 'ar-EG', digits: 2 },
  TND: { code: 'TND', symbol: 'TND', name: 'Tunisian Dinar', locale: 'fr-TN', digits: 3 },
  DZD: { code: 'DZD', symbol: 'DZD', name: 'Algerian Dinar', locale: 'fr-DZ', digits: 2 },
  XOF: { code: 'XOF', symbol: 'CFA', name: 'West African CFA', locale: 'fr-SN', digits: 0 },
};

export function formatCurrency(amount: number, currencyCode: string = 'MAD', uiLocale?: string): string {
  const safeAmount = isNaN(amount) || !isFinite(amount) ? 0 : amount;
  const config = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.MAD;
  const locale = uiLocale || config.locale;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: config.digits,
      maximumFractionDigits: config.digits,
    }).format(safeAmount);
  } catch {
    return `${safeAmount.toFixed(config.digits)} ${config.symbol}`;
  }
}

export function getCurrencySymbol(currencyCode: string = 'MAD'): string {
  return SUPPORTED_CURRENCIES[currencyCode]?.symbol || currencyCode;
}

export function formatCurrencyParts(amount: number, currencyCode: string = 'MAD', uiLocale?: string): { amount: string; currency: string } {
  const safeAmount = isNaN(amount) || !isFinite(amount) ? 0 : amount;
  const config = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.MAD;
  const locale = uiLocale || config.locale;

  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: config.digits,
      maximumFractionDigits: config.digits,
    }).format(safeAmount);
    // Split "32,500.00 MAD" or "€32,500.00" into amount and currency
    const match = formatted.match(/^([^\d]*)([\d.,]+)(.*)$/);
    if (match) {
      const currency = (match[1] + match[3]).trim() || config.symbol;
      return { amount: match[2], currency };
    }
    return { amount: formatted, currency: config.symbol };
  } catch {
    return { amount: safeAmount.toFixed(config.digits), currency: config.symbol };
  }
}
