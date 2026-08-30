'use client';

import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { HouseholdProvider } from '@/lib/household-context';
import { LanguageProvider } from '@/lib/i18n-context';
import FirebaseAnalytics from '@/components/FirebaseAnalytics';

/**
 * Providers that require Firebase (auth, household, currency, i18n).
 *
 * IMPORTANT (performance): this is intentionally mounted ONLY on the
 * authenticated app routes (/login, /onboarding, /dashboard) — never in the
 * root layout. Mounting it globally made every public page (home, blog,
 * legal pages) download, parse and hydrate the Firebase SDK even though the
 * marketing site never needs it.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <HouseholdProvider><CurrencyProvider>
          <Suspense fallback={null}>
            <FirebaseAnalytics />
          </Suspense>
          {children}
        </CurrencyProvider></HouseholdProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
