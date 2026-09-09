import type { Messages } from './i18n-core';

/**
 * Post-hydration document title for a route, or `null` to keep the
 * prerendered `<title>` from route metadata.
 *
 * Public/marketing pages ship a keyword-bearing `<title>` from their server
 * `metadata`, and Google renders JavaScript — so whatever the client sets
 * here is what can end up in the index. English sessions therefore keep the
 * prerendered title verbatim on every public page; other locales swap in
 * their translation only where one is mapped. Routes without a mapped
 * translation (features/*, budgeting-methods/*, blog posts) keep the
 * prerendered title in every locale instead of degrading to
 * "SmartJib · SmartJib".
 *
 * Private dashboard screens are `noindex`, so they always get a per-route
 * tab title in every locale.
 *
 * Pure (no React) so the rules above are unit-testable in tests/seo.test.ts.
 */
export function resolveHydratedTitle(
  pathname: string | null,
  language: string,
  messages: Messages,
  appName: string,
): string | null {
  if (!pathname || pathname.startsWith('/blog/')) return null;

  const dashboardTitles: Record<string, string | undefined> = {
    '/dashboard': messages.navigation.dashboardOverview,
    '/dashboard/fixed': messages.navigation.fixedBills,
    '/dashboard/variable': messages.navigation.variableExpenses,
    '/dashboard/courses': messages.navigation.courseSession,
    '/dashboard/savings': messages.navigation.savingsGoals,
    '/dashboard/trends': messages.navigation.trendsAnalytics,
    '/dashboard/debts': messages.navigation.debtsCredits,
    '/dashboard/profile': messages.navigation.profileAccount,
    '/dashboard/profile/account': messages.profile.subpages.accountTitle,
    '/dashboard/profile/data': messages.profile.subpages.dataTitle,
    '/dashboard/profile/money-sources': messages.profile.subpages.moneySourcesTitle,
    '/dashboard/profile/preferences': messages.profile.subpages.preferencesTitle,
    '/dashboard/profile/pro': messages.profile.subpages.proTitle,
    '/dashboard/profile/reminders': messages.profile.subpages.remindersTitle,
    '/dashboard/profile/security': messages.profile.subpages.securityTitle,
    '/dashboard/profile/workspace': messages.profile.subpages.workspaceTitle,
  };

  const dashboardTitle = dashboardTitles[pathname];
  if (dashboardTitle !== undefined) return `${dashboardTitle} · ${appName}`;

  if (language === 'en') return null;

  const publicTitle: string | undefined = {
    '/': messages.seo.titles.landing ?? appName,
    '/about': messages.static.about.eyebrow,
    '/help': messages.static.help.eyebrow,
    '/careers': messages.static.careers.eyebrow,
    '/contact': messages.static.contact.eyebrow,
    '/cookies': messages.static.cookies.title,
    '/privacy': messages.legal.privacyTitle,
    '/terms': messages.legal.termsTitle,
    '/blog': messages.seo.titles.blog,
    '/login': messages.auth.signIn,
    '/onboarding': messages.onboarding.step1Title,
  }[pathname];

  if (publicTitle === undefined) return null;
  return pathname === '/' ? publicTitle : `${publicTitle} · ${appName}`;
}
