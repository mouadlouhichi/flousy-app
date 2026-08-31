'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLightLanguage } from '@/lib/i18n-light';

/**
 * Route metadata is statically generated for a fast, cacheable app shell.
 * Reflect the active client locale in the browser tab after hydration so an
 * Arabic or French session does not retain an English page title.
 */
export function LocalizedDocumentTitle() {
  const pathname = usePathname();
  const { messages: m } = useLightLanguage();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/blog/')) return;

    const dashboardTitles: Record<string, string> = {
      '/dashboard': m.navigation.dashboardOverview,
      '/dashboard/fixed': m.navigation.fixedBills,
      '/dashboard/variable': m.navigation.variableExpenses,
      '/dashboard/courses': m.navigation.courseSession,
      '/dashboard/savings': m.navigation.savingsGoals,
      '/dashboard/trends': m.navigation.trendsAnalytics,
      '/dashboard/debts': m.navigation.debtsCredits,
      '/dashboard/profile': m.navigation.profileAccount,
      '/dashboard/profile/account': m.profile.subpages.accountTitle,
      '/dashboard/profile/data': m.profile.subpages.dataTitle,
      '/dashboard/profile/money-sources': m.profile.subpages.moneySourcesTitle,
      '/dashboard/profile/preferences': m.profile.subpages.preferencesTitle,
      '/dashboard/profile/pro': m.profile.subpages.proTitle,
      '/dashboard/profile/workspace': m.profile.subpages.workspaceTitle,
    };

    const title =
      dashboardTitles[pathname] ??
      ({
        '/': m.common.appName,
        '/about': m.static.about.eyebrow,
        '/help': m.static.help.eyebrow,
        '/careers': m.static.careers.eyebrow,
        '/contact': m.static.contact.eyebrow,
        '/cookies': m.static.cookies.title,
        '/privacy': m.legal.privacyTitle,
        '/terms': m.legal.termsTitle,
        '/blog': m.static.blog.eyebrow,
        '/login': m.auth.signIn,
        '/onboarding': m.onboarding.step1Title,
      }[pathname] ?? m.common.appName);

    document.title = pathname === '/' ? title : `${title} · ${m.common.appName}`;
  }, [m, pathname]);

  return null;
}
