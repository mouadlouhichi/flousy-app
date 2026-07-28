'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { formatCurrency, getCurrencySymbol } from './currency';
import { useAuth } from './auth-context';

interface CurrencyContextType {
  currency: string;
  setCurrency: (c: string) => void;
  format: (amount: number) => string;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { profile, updateProfileData } = useAuth();
  const [currency, setCurrencyState] = useState<string>(profile?.currency || 'MAD');

  useEffect(() => {
    if (profile?.currency) {
      setCurrencyState(profile.currency);
    }
  }, [profile?.currency]);

  const setCurrency = (c: string) => {
    setCurrencyState(c);
    updateProfileData({ currency: c }).catch((e: unknown) => console.error(e));
  };

  const format = (amount: number) => formatCurrency(amount, currency);
  const symbol = getCurrencySymbol(currency);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format, symbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
