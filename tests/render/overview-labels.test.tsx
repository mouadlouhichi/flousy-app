/**
 * WCAG 2.5.3 Label in Name (overview screen):
 * every button with visible text must contain that visible text inside its
 * accessible name, so voice-control users can activate what they see
 * ("click Cash…"). Regression: the money-place history buttons and the
 * strategy pill used aria-labels that dropped the visible amount/strategy
 * name (Lighthouse `label-content-name-mismatch`).
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../../messages/en.json';
import { formatMessage, getIntlLocale, type Messages } from '../../src/lib/i18n-core';
import type { MonthBudget } from '../../src/lib/store';

const catalogs: Messages = en as Messages;

const languageValue = () => ({
  language: 'en' as const,
  setLanguage: () => {},
  messages: catalogs,
  t: (tpl: string, v?: Record<string, string | number>) => formatMessage(tpl, v, getIntlLocale('en')),
  translate: (p: string) => p,
  isRTL: false,
  intlLocale: getIntlLocale('en'),
  localeNames: { en: 'English', fr: 'Français', ar: 'العربية' },
});

function month(): MonthBudget {
  return {
    totalBudget: 10000,
    strategyId: '50-30-20',
    periodStartDate: '2026-09-01',
    periodEndDate: '2026-09-30',
    periodKey: '2026-09',
    bankPart: 4000,
    homePart: 0,
    walletPart: 500,
    variableExpenses: [],
    fixedBills: [],
    savingsActivity: [],
    incomeSources: [],
    debts: [],
  } as unknown as MonthBudget;
}

mock.module('@/lib/i18n-context', { namedExports: { useLanguage: languageValue, LanguageProvider: ({ children }: { children: React.ReactNode }) => children } });
mock.module('@/lib/currency-context', {
  namedExports: {
    useCurrency: () => ({ currency: 'MAD', symbol: 'MAD', format: (n: number) => `${n.toFixed(2)} MAD`, formatParts: (n: number) => ({ amount: n.toFixed(2), currency: 'MAD' }), setCurrency: () => {} }),
  },
});
mock.module('@/lib/auth-context', {
  namedExports: {
    useAuth: () => ({ user: { uid: 'u1', email: 't@example.com' }, profile: { id: 'u1', displayName: 'Test' }, updateProfileData: async () => {}, deleteAllData: async () => {}, signOut: async () => {} }),
    AccountDeletionIncompleteError: class extends Error {},
  },
});
mock.module('@/lib/household-context', {
  namedExports: {
    useHousehold: () => ({
      workspace: 'personal',
      household: null,
      canViewArea: () => true,
      canEditArea: () => true,
      members: [],
      isOwner: true,
      exportSections: { variableExpenses: true, fixedBills: true, income: true, savings: true, debts: true, balances: true, courses: true },
      memberships: [],
      switchWorkspace: async () => {},
      createBusinessWorkspace: async () => {},
      roleInfo: null,
    }),
    useOptionalHousehold: () => null,
  },
});
mock.module('@/components/dashboard/dashboard-provider', {
  namedExports: {
    useDashboard: () => ({
      month: month(),
      goals: [],
      openExpenseModal: () => {},
      openMoveMoneyModal: () => {},
      openEditMoneyPlaces: () => {},
      openSavingsEntryModal: () => {},
      handleUpdateTotalBudget: async () => {},
      handleUpdateStrategy: () => {},
      isPro: true,
      openProModal: () => {},
    }),
  },
});
mock.module('@/lib/analytics', { namedExports: { trackEvent: () => {} } });
mock.module('next/navigation', { namedExports: { useRouter: () => ({ push: () => {} }), usePathname: () => '/dashboard', useSearchParams: () => new URLSearchParams() } });

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}

function normalize(s: string): string {
  return decodeEntities(s).replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Text a sighted user sees: markup, icons and sr-only notes excluded. */
function visibleText(buttonInnerHtml: string): string {
  const withoutSrOnly = buttonInnerHtml.replace(/<span[^>]*\bsr-only\b[^>]*>[\s\S]*?<\/span>/g, '');
  const withoutIcons = withoutSrOnly.replace(/<svg[\s\S]*?<\/svg>/g, '');
  return normalize(withoutIcons.replace(/<[^>]*>/g, ''));
}

/** Accessible name: aria-label when present, otherwise name from contents. */
function accessibleName(buttonAttrs: string, buttonInnerHtml: string): string {
  const labelled = buttonAttrs.match(/aria-label="([^"]*)"/);
  if (labelled) return normalize(labelled[1]);
  const withoutIcons = buttonInnerHtml.replace(/<svg[\s\S]*?<\/svg>/g, '');
  return normalize(withoutIcons.replace(/<[^>]*>/g, ''));
}

describe('overview screen: label in name (WCAG 2.5.3)', () => {
  it('contains every button’s visible text in its accessible name', async () => {
    const { OverviewScreen } = await import(
      '../../src/components/dashboard/screens/overview-screen'
    );
    const html = renderToStaticMarkup(React.createElement(OverviewScreen));

    const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    assert.ok(buttons.length > 0, 'expected overview buttons to render');
    // The fixtures render 3 money places + the strategy pill + edit affordances.
    assert.ok(html.includes('View Bank history'), 'place history action should be named');
    assert.ok(html.includes('Change budget strategy'), 'strategy action should be named');

    for (const [, attrs, inner] of buttons) {
      const seen = visibleText(inner);
      if (!seen) continue; // icon-only buttons have no visible label to match
      const name = accessibleName(attrs, inner);
      assert.ok(
        name.includes(seen),
        `button accessible name ${JSON.stringify(name)} misses visible text ${JSON.stringify(seen)}`,
      );
    }
  });
});
