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
import { formatDayOfMonth } from '@/lib/utils';

const LINKS: Array<{
  href: string;
  icon: string;
  title: string;
  hint: (ctx: { currency: string; language: string; theme: string; start?: number; places: number }) => string;
}> = [
  {
    href: '/dashboard/profile/preferences',
    icon: 'tune',
    title: 'Preferences',
    hint: ({ currency, language, theme, start }) =>
      [currency, language.toUpperCase(), theme, start ? `starts ${formatDayOfMonth(start)}` : null]
        .filter(Boolean)
        .join(' · '),
  },
  {
    href: '/dashboard/profile/money-sources',
    icon: 'account_balance_wallet',
    title: 'Money sources',
    hint: ({ places }) => `${places} location${places === 1 ? '' : 's'}`,
  },
  {
    href: '/dashboard/profile/workspace',
    icon: 'group',
    title: 'Workspace',
    hint: () => 'Personal dashboard & household',
  },
  {
    href: '/dashboard/profile/pro',
    icon: 'workspace_premium',
    title: 'Pro',
    hint: () => 'Plan, income sources & insights',
  },
  {
    href: '/dashboard/profile/data',
    icon: 'database',
    title: 'Data',
    hint: () => 'Export, import, delete',
  },
  {
    href: '/dashboard/profile/account',
    icon: 'manage_accounts',
    title: 'Account',
    hint: () => 'Sign out & delete account',
  },
];

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
  const { language } = useLanguage();
  const { month } = useDashboard();
  const { places } = useMoneyPlaces(month);
  const ctx = {
    currency,
    language,
    theme: profile?.theme || 'system',
    start: profile?.monthStartDate,
    places: places.length,
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <ProfileIdentity />

      <nav className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
        {LINKS.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`group flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface-container-high ${
              index > 0 ? 'border-t border-outline-variant/30' : ''
            }`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-variant">
                <AppIcon name={item.icon} className="text-[20px] text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-on-surface">{item.title}</span>
                <span className="block truncate text-xs text-on-surface-variant">{item.hint(ctx)}</span>
              </span>
            </span>
            <AppIcon
              name="chevron_right"
              className="text-[20px] text-on-surface-variant transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </nav>
    </div>
  );
}
