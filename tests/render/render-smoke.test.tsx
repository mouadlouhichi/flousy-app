/**
 * Server-renders every new Pro/insight component with realistic data and
 * stubbed app contexts, in all three locales. Catches runtime crashes
 * (missing i18n keys, undefined access, bad hook usage) that type-checking
 * cannot: if any of these throw, the page they live on would white-screen.
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';
import { formatMessage, getIntlLocale, type Language, type Messages } from '../../src/lib/i18n-core';
import type { MonthBudget, SavingGoal } from '../../src/lib/store';

const catalogs: Record<Language, Messages> = { en: en as Messages, fr: fr as Messages, ar: ar as Messages };
let current: Language = 'en';

const languageValue = () => ({
  language: current,
  setLanguage: () => {},
  messages: catalogs[current],
  t: (tpl: string, v?: Record<string, string | number>) => formatMessage(tpl, v, getIntlLocale(current)),
  translate: (p: string) => p,
  isRTL: current === 'ar',
  intlLocale: getIntlLocale(current),
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
    fixedExpenses: [
      { id: 'rent', name: 'Rent', amount: 3000, type: 'Rent', date: '5th', place: 'bank', status: 'paid', paidAmount: 3000 },
      { id: 'phone', name: 'Phone', amount: 200, type: 'Phone', date: '20th', place: 'bank', status: 'planned' },
    ],
    variableExpenses: [
      { id: 'v1', name: 'Marjane', amount: 300, type: 'Food', date: '2026-09-02', place: 'wallet', tags: ['groceries'] },
      { id: 'v2', name: 'Taxi', amount: 100, type: 'Transport', date: '2026-09-05', place: 'wallet' },
    ],
    incomeSources: [{ id: 'salary', name: 'Salary', amount: 8000, status: 'planned', receivedAmount: 0, payDay: 28 }],
    debts: [
      { id: 'd1', name: 'Car loan', type: 'debt', amount: 12000, paidAmount: 2000, status: 'open', rate: 6, minPayment: 300 },
      { id: 'd2', name: 'Friend', type: 'credit', amount: 500, paidAmount: 0, status: 'open' },
    ],
  } as unknown as MonthBudget;
}
const goals: SavingGoal[] = [
  { id: 'g1', name: 'Trip', target: 6000, current: 1500, history: [{ id: 'h1', amount: 1500, date: '2026-08-15', type: 'deposit' }] } as unknown as SavingGoal,
];

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
      isPro: true,
      proUnlocked: true,
      openProModal: () => {},
      month: month(),
      goals,
      currentMonthKey: '2026-09',
      trendsMonths: [{ monthKey: '2026-09', month: month() }],
      trendsLoading: false,
      goToMonth: () => {},
      openCsvModal: () => {},
      retrySync: async () => {},
      openFixedModal: () => {},
      updateAndSaveMonth: async () => {},
    }),
  },
});
mock.module('@/lib/db', { namedExports: { exportFinanceBackup: async () => ({}), restoreFinanceBackup: async () => {}, syncWorkspaceTransactions: async () => {}, FinanceRestoreIncompleteError: class extends Error {}, WorkspaceSyncError: class extends Error {} } });
mock.module('@/lib/analytics', { namedExports: { trackEvent: () => {} } });
mock.module('@/hooks/use-toast', { namedExports: { useToast: () => ({ toast: () => {} }) } });
mock.module('next/link', { defaultExport: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement('a', { href }, children) });
mock.module('next/navigation', { namedExports: { useRouter: () => ({ push: () => {} }), usePathname: () => '/dashboard', useSearchParams: () => new URLSearchParams() } });

async function load() {
  const [safe, net, debt, goal, cal, upcoming, report, fx, chart, sec, rem, data, search, fixedTab] = await Promise.all([
    import('../../src/components/dashboard/safe-to-spend-card'),
    import('../../src/components/dashboard/net-worth-card'),
    import('../../src/components/dashboard/debt-payoff-planner'),
    import('../../src/components/dashboard/goal-projection'),
    import('../../src/components/dashboard/cash-flow-calendar'),
    import('../../src/components/dashboard/upcoming-payments-calendar'),
    import('../../src/components/dashboard/custom-report-card'),
    import('../../src/components/dashboard/currency-converter'),
    import('../../src/components/charts/month-trend-chart'),
    import('../../src/components/dashboard/profile/security-panel'),
    import('../../src/components/dashboard/profile/reminders-panel'),
    import('../../src/components/dashboard/profile/data-panel'),
    import('../../src/components/dashboard/screens/search-screen'),
    import('../../src/components/tabs/FixedTab'),
  ]);
  return { safe, net, debt, goal, cal, upcoming, report, fx, chart, sec, rem, data, search, fixedTab };
}

const render = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('render smoke: new feature components', async () => {
  const c = await load();
  const m = month();

  for (const lang of ['en', 'fr', 'ar'] as const) {
    describe(lang, () => {
      it('SafeToSpendCard (locked + unlocked)', () => {
        current = lang;
        const a = render(<c.safe.SafeToSpendCard month={m} unlocked onUpgrade={() => {}} />);
        const b = render(<c.safe.SafeToSpendCard month={m} unlocked={false} onUpgrade={() => {}} />);
        assert.match(a, /MAD/);
        assert.match(b, /Pro/);
        assert.doesNotMatch(a + b, /\[object|undefined|NaN/);
      });
      it('NetWorthCard', () => {
        current = lang;
        const html = render(<c.net.NetWorthCard month={m} goals={goals} />);
        assert.doesNotMatch(html, /undefined|NaN/);
      });
      it('DebtPayoffPlanner', () => {
        current = lang;
        const html = render(<c.debt.DebtPayoffPlanner month={m} unlocked onUpgrade={() => {}} />);
        assert.match(html, /Car loan/);
        assert.doesNotMatch(html, /undefined|NaN/);
      });
      it('GoalProjection', () => {
        current = lang;
        const html = render(<c.goal.GoalProjection goal={goals[0]!} monthlyDeposits={[500, 1000]} unlocked onUpgrade={() => {}} />);
        assert.doesNotMatch(html, /undefined|NaN/);
      });
      it('CashFlowCalendar (locked + unlocked)', () => {
        current = lang;
        const a = render(<c.cal.CashFlowCalendar month={m} forecastUnlocked onUpgrade={() => {}} />);
        const b = render(<c.cal.CashFlowCalendar month={m} forecastUnlocked={false} onUpgrade={() => {}} />);
        assert.equal((a.match(/role="gridcell"/g) || []).length, 30);
        assert.match(a, /Phone/);
        assert.doesNotMatch(a + b, /undefined|NaN/);
      });
      it('UpcomingPaymentsCalendar', () => {
        current = lang;
        const html = render(<c.upcoming.UpcomingPaymentsCalendar month={m} />);
        assert.match(html, /Rent/);
      });
      it('CustomReportCard', () => {
        current = lang;
        const html = render(<c.report.CustomReportCard months={[{ monthKey: '2026-09', month: m }]} unlocked onUpgrade={() => {}} canSeeFixedBills />);
        assert.doesNotMatch(html, /undefined|NaN/);
      });
      it('CurrencyConverter', () => {
        current = lang;
        const html = render(<c.fx.CurrencyConverter />);
        assert.match(html, /Swap currencies|Inverser les devises|تبديل العملات/);
        assert.doesNotMatch(html, /undefined|NaN/);
      });
      it('SecurityPanel', () => {
        current = lang;
        const html = render(<c.sec.SecurityPanel />);
        assert.doesNotMatch(html, /undefined|NaN/);
      });
      it('RemindersPanel', () => {
        current = lang;
        const html = render(<c.rem.RemindersPanel />);
        assert.match(html, /Rent/);
      });
      it('DataPanel', () => {
        current = lang;
        const html = render(<c.data.DataPanel />);
        assert.doesNotMatch(html, /undefined|NaN/);
      });
      it('SearchScreen', () => {
        current = lang;
        const html = render(<c.search.SearchScreen />);
        assert.doesNotMatch(html, /undefined|NaN/);
      });
      it('FixedTab', () => {
        current = lang;
        const html = render(<c.fixedTab.FixedTab month={m} onOpenAddModal={() => {}} onEditBill={() => {}} forecastUnlocked onUpgrade={() => {}} />);
        assert.match(html, /role="tab"/);
      });
      it('MonthTrendChart', () => {
        current = lang;
        const html = render(
          <c.chart.MonthTrendChart
            data={[
              { monthKey: '2026-08', label: 'Aug', totalSpent: 5000, totalBudget: 6000, netSaved: 1000 },
              { monthKey: '2026-09', label: 'Sep', totalSpent: 7000, totalBudget: 6000, netSaved: 0 },
            ]}
            format={(n: number) => `${n} MAD`}
            labels={{ spent: 'Spent', budget: 'Budget', netSaved: 'Saved' }}
            compactAxis={(n: number) => String(n)}
          />,
        );
        assert.doesNotMatch(html, /undefined|NaN/);
      });
    });
  }
});
