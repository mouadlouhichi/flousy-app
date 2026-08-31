'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppIcon } from '@/components/ui/app-icon';
import { ProfileIdentity } from '../profile/profile-identity';
import { useMoneyPlaces } from '@/lib/use-money-places';
import { useDashboard } from '../dashboard-provider';
import { useLanguage } from '@/lib/i18n-context';
import { useCurrency } from '@/lib/currency-context';
import { useAuth } from '@/lib/auth-context';
import { formatLocalizedDayOfMonth } from '@/lib/localized-labels';

/**
 * Profile hub — Facebook-style. Identity on top, then grouped settings
 * that each open their own page instead of editing everything inline.
 */
export function ProfileScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('invite');
  useEffect(() => {
    if (inviteCode) {
      router.replace(`/dashboard/profile/workspace?invite=${encodeURIComponent(inviteCode)}`);
    }
  }, [inviteCode, router]);

  const { profile } = useAuth();
  const { currency } = useCurrency();
  const { language, messages: m, t, intlLocale, isRTL, localeNames } = useLanguage();
  const p = m.profile;
  const { month } = useDashboard();
  const { places } = useMoneyPlaces(month);
  const theme = profile?.theme || 'system';
  const themeLabel = m.settings[theme];
  const preferenceHint = [
    currency,
    localeNames[language],
    themeLabel,
    profile?.monthStartDate
      ? t(p.hints.budgetStarts, {
          day: formatLocalizedDayOfMonth(profile.monthStartDate, language, intlLocale),
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const groups = [
    {
      label: p.groups.settings,
      items: [
        { href: '/dashboard/profile/preferences', icon: 'tune', title: p.links.preferences, hint: preferenceHint },
        {
          href: '/dashboard/profile/money-sources',
          icon: 'account_balance_wallet',
          title: p.links.moneySources,
          hint: t(p.hints.locations, { count: places.length }),
        },
      ],
    },
    {
      label: p.groups.workspace,
      items: [
        {
          href: '/dashboard/profile/workspace',
          icon: 'group',
          title: p.links.workspace,
          hint: p.hints.personalAndHousehold,
        },
        { href: '/dashboard/profile/pro', icon: 'workspace_premium', title: p.links.pro, hint: p.hints.planIncomeInsights },
      ],
    },
    {
      label: p.groups.privacyAccount,
      items: [
        { href: '/dashboard/profile/data', icon: 'database', title: p.links.data, hint: p.hints.exportImportDelete },
        { href: '/dashboard/profile/account', icon: 'manage_accounts', title: p.links.account, hint: p.hints.signOutDelete },
      ],
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 pb-24">
      <ProfileIdentity />

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-2">
            <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-on-surface-variant">
              {group.label}
            </h3>
            <nav className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
              {group.items.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={`group flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface-container-high ${
                    index > 0 ? 'border-t border-outline-variant/30' : ''
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <AppIcon name={item.icon} className="text-[20px] text-primary" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-on-surface">{item.title}</span>
                      <span className="block truncate text-xs text-on-surface-variant">{item.hint}</span>
                    </span>
                  </span>
                  <AppIcon
                    name="chevron_right"
                    className={`text-[20px] text-on-surface-variant transition-transform ${isRTL ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}
                  />
                </Link>
              ))}
            </nav>
          </section>
        ))}
      </div>
    </div>
  );
}
