/**
 * Debts screen wiring (SSR smoke):
 *  - the debt payoff plan is rendered through the DebtsTab slot, inside the
 *    "Debts (I owe)" sub-tab content (after the totals card), not above the
 *    sub-tab switcher where the credits tab would also see it;
 *  - the Add flow opens the debt modal preselected to the sub-tab's side:
 *    'debt' by default, and 'credit' ("Owed to Me" / Add Credit) when opened
 *    from the credits tab via DebtModal's defaultType.
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
    debts: [
      { id: 'd1', name: 'Car loan', type: 'debt', amount: 12000, paidAmount: 2000, status: 'open', rate: 6, minPayment: 300 },
      { id: 'd2', name: 'Friend', type: 'credit', amount: 500, paidAmount: 0, status: 'open' },
    ],
  } as unknown as MonthBudget;
}

mock.module('@/lib/i18n-context', { namedExports: { useLanguage: languageValue, LanguageProvider: ({ children }: { children: React.ReactNode }) => children } });
mock.module('@/lib/currency-context', {
  namedExports: {
    useCurrency: () => ({ currency: 'MAD', symbol: 'MAD', format: (n: number) => `${n.toFixed(2)} MAD`, formatParts: (n: number) => ({ amount: n.toFixed(2), currency: 'MAD' }), setCurrency: () => {} }),
  },
});
const profile = { id: 'u1', displayName: 'Test', debtPayoffBudget: 500, debtPayoffMethod: 'snowball' };
mock.module('@/lib/auth-context', {
  namedExports: {
    useAuth: () => ({ user: { uid: 'u1', email: 't@example.com' }, profile, updateProfileData: async () => {}, deleteAllData: async () => {}, signOut: async () => {} }),
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
      openDebtModal: () => {},
      updateAndSaveMonth: async () => {},
      user: { uid: 'u1' },
      proUnlocked: true,
      openProModal: () => {},
    }),
  },
});
mock.module('@/lib/analytics', { namedExports: { trackEvent: () => {} } });
mock.module('next/navigation', { namedExports: { useRouter: () => ({ push: () => {} }), usePathname: () => '/dashboard/debts', useSearchParams: () => new URLSearchParams() } });
// The shared Modal sheets portal into document.body (null on the server), so
// render it as a plain pass-through to inspect the debt form itself.
mock.module('@/components/ui/Modal', {
  namedExports: {
    Modal: ({ title, children }: { title: string; children?: React.ReactNode }) =>
      React.createElement('section', { 'data-modal-title': title }, children),
  },
});

async function load() {
  const [screen, tab, modal] = await Promise.all([
    import('../../src/components/dashboard/screens/debts-screen'),
    import('../../src/components/tabs/DebtsTab'),
    import('../../src/components/modals/DebtModal'),
  ]);
  return { screen, tab, modal };
}

const render = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('debts screen: payoff plan scoped to the debts tab', async () => {
  const c = await load();

  it('DebtsScreen renders the payoff plan inside the debts sub-tab content', () => {
    const html = render(<c.screen.DebtsScreen />);
    // The plan itself is present (pro unlocked, one open debt)…
    assert.match(html, /Debt payoff plan/);
    assert.match(html, /Car loan/);
    // …below the tab's totals card, not above the sub-tab switcher.
    assert.ok(html.indexOf('TOTAL YOU OWE') < html.indexOf('Debt payoff plan'));
    assert.ok(html.indexOf('Debts (I owe)') < html.indexOf('Debt payoff plan'));
  });

  it('DebtsTab renders the payoffPlan slot for the debts sub-tab', () => {
    const withPlan = render(
      <c.tab.DebtsTab
        month={month()}
        canEdit
        onOpenDebtModal={() => {}}
        onEditDebt={() => {}}
        onRecordPayment={() => {}}
        onDeletePayment={() => {}}
        payoffPlan={<div data-testid="payoff-plan-slot" />}
      />,
    );
    assert.match(withPlan, /data-testid="payoff-plan-slot"/);
    // The slot content sits after the totals card, before the debt list.
    assert.ok(withPlan.indexOf('TOTAL YOU OWE') < withPlan.indexOf('payoff-plan-slot'));
    assert.ok(withPlan.indexOf('payoff-plan-slot') < withPlan.indexOf('Car loan'));
  });
});

describe('debt modal: Add preselects the sub-tab side', async () => {
  const c = await load();

  it('defaults to the debt side ("Add Debt" / "I Owe")', () => {
    const html = render(<c.modal.DebtModal isOpen onClose={() => {}} onSave={() => {}} />);
    assert.match(html, /data-modal-title="Add Debt"/);
    assert.match(html, /aria-checked="true"[^>]*data-segment="debt"/);
    assert.match(html, /aria-checked="false"[^>]*data-segment="credit"/);
  });

  it('opened from the credits tab: type=credit selected and titled "Add Credit"', () => {
    const html = render(<c.modal.DebtModal isOpen onClose={() => {}} onSave={() => {}} defaultType="credit" />);
    assert.match(html, /data-modal-title="Add Credit"/);
    assert.match(html, /aria-checked="true"[^>]*data-segment="credit"/);
    assert.match(html, /aria-checked="false"[^>]*data-segment="debt"/);
    // The submit button label follows the selected side too.
    assert.match(html, /<span>Add Credit<\/span>/);
  });

  it('editing keeps the edit title regardless of the default side', () => {
    // Note: the initialDebt → state sync lives in useEffect (browser-only),
    // so SSR shows the default segment; only the title is computed inline.
    const html = render(
      <c.modal.DebtModal
        isOpen
        onClose={() => {}}
        onSave={() => {}}
        initialDebt={{ id: 'd2', name: 'Friend', amount: 500, type: 'credit', status: 'open', date: '2026-09-01', payments: [] } as never}
      />,
    );
    assert.match(html, /data-modal-title="Edit Debt"/);
    assert.match(html, /<span>Save Changes<\/span>/);
  });
});
