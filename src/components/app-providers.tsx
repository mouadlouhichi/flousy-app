'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { HouseholdProvider } from '@/lib/household-context';
import { LanguageProvider } from '@/lib/i18n-context';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <HouseholdProvider><CurrencyProvider>{children}</CurrencyProvider></HouseholdProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
