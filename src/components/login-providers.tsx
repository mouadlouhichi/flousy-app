'use client';

import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { LanguageProvider } from '@/lib/i18n-context';
import FirebaseAnalytics from '@/components/FirebaseAnalytics';

/**
 * Auth + i18n + currency only — used on /login so household listeners cannot
 * block sign-in.
 *
 * This lives in its own file, not beside <AppProviders>, on purpose: a client
 * boundary's preload set is the full module closure of the file it points
 * at. When LoginProviders was exported from app-providers.tsx — whose module
 * top-level also imports HouseholdProvider (→ ./db → the Firestore SDK) —
 * /login shipped ~150 KiB of Firestore JavaScript to every anonymous visitor
 * before they could possibly need it. See household-context-lite.ts for the
 * other half of that leak.
 */
export function LoginProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <CurrencyProvider>
          <Suspense fallback={null}>
            <FirebaseAnalytics />
          </Suspense>
          {children}
        </CurrencyProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
