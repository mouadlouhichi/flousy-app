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
  const { messages: m, language } = useLightLanguage();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/blog/')) return;

    // Public/marketing pages are prerendered with a keyword-bearing <title>
    // supplied by route metadata (landing keeps its own). Overwriting it with a
    // localized label on hydration would drop those keywords for crawlers, so
    // English sessions — for which the prerendered title is already correct —
    // are left alone, and other locales get the same keyword-first shape.
    if (pathname === '/' && language === 'en') return;

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
        '/': m.seo.titles.landing ?? m.common.appName,
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
  }, [m, language, pathname]);

  return null;
}
