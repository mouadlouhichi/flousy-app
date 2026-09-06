'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatCurrencyParts, getCurrencySymbol } from './currency';
import { useAuth } from './auth-context';
import { useLanguage } from './i18n-context';
import { useOptionalHousehold } from './household-context';
import { trackEvent } from './analytics';

interface CurrencyContextType {
  /** Currency used to render the active period (can be a historical snapshot). */
  currency: string;
  /** Authoritative personal/household currency for newly created periods. */
  configuredCurrency: string;
  setCurrency: (currency: string) => Promise<void>;
  setPeriodCurrency: (currency: string | null) => void;
  format: (amount: number) => string;
  formatParts: (amount: number) => { amount: string; currency: string };
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { profile, updateProfileData } = useAuth();
  const householdContext = useOptionalHousehold();
  const { intlLocale } = useLanguage();
  const configuredCurrency =
    householdContext?.workspace === 'household'
      ? householdContext.household?.currency || 'MAD'
      : profile?.currency || 'MAD';
  const [periodCurrency, setPeriodCurrency] = useState<string | null>(null);

  useEffect(() => {
    // Workspace switches should never retain the previous workspace's period snapshot.
    setPeriodCurrency(null);
  }, [householdContext?.workspace, householdContext?.household?.id]);

  const currency = periodCurrency || configuredCurrency;

  const setCurrency = async (nextCurrency: string) => {
    if (householdContext?.workspace === 'household') {
      await householdContext.updateConfiguration({ currency: nextCurrency });
    } else {
      await updateProfileData({ currency: nextCurrency });
    }
    // Existing non-empty periods keep their own currency snapshot. The
    // dashboard bridge will re-assert it; outside a period we can update now.
    if (!periodCurrency) setPeriodCurrency(null);
    trackEvent('change_currency', { currency: nextCurrency });
  };

  const value = useMemo<CurrencyContextType>(() => ({
    currency,
    configuredCurrency,
    setCurrency,
    setPeriodCurrency,
    format: (amount) => formatCurrency(amount, currency, intlLocale),
    formatParts: (amount) => formatCurrencyParts(amount, currency, intlLocale),
    symbol: getCurrencySymbol(currency),
  // `setCurrency` is intentionally recreated with the current persistence target.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currency, configuredCurrency, intlLocale, householdContext?.workspace, periodCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider');
  return context;
}
