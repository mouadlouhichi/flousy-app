'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { db as firestoreDb } from '@/lib/firebase-db';
import { AppIcon } from '@/components/ui/app-icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProfileIdentity } from '../profile/profile-identity';
import { useMoneyPlaces } from '@/lib/use-money-places';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { isProFeatureUnlocked } from '@/lib/household';
import { TOOL_AREA } from '@/lib/household-rbac';
import { useLanguage } from '@/lib/i18n-context';
import { useCurrency } from '@/lib/currency-context';
import { useAuth } from '@/lib/auth-context';
import { formatLocalizedDayOfMonth } from '@/lib/localized-labels';
import { isProUser } from '@/lib/pro-features';

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
      router.replace(`/dashboard/profile/household?invite=${encodeURIComponent(inviteCode)}`);
    }
  }, [inviteCode, router]);

  const { profile, user } = useAuth();
  const { currency } = useCurrency();
  const { language, messages: m, t, intlLocale, isRTL, localeNames } = useLanguage();
  const p = m.profile;
  const { month, isPro, openIncomeModal, openProModal, closeCurrentMonth, isMounted, syncState } = useDashboard();
  const { workspace, household, isOwner, canViewArea } = useHousehold();
  // Live count of active Darat circles the user belongs to (organizer or
  // member). Used as the hint under the Profile → Workspace group entry so
  // the user can see "3 active circles" at a glance without opening the page.
  const [daratCount, setDaratCount] = useState<number | null>(null);
  const proForDarat = isProUser(profile);
  useEffect(() => {
    // Demo mode (no Firebase) and un-pro accounts both short-circuit:
    // the hint then falls back to the Pro-gate copy, no subscription needed.
    if (!isFirebaseConfigured || !firestoreDb || !user?.uid || !proForDarat) {
      setDaratCount(null);
      return;
    }
    const db = firestoreDb;
    // One live source: the `users/{uid}/circles` pointer stream. The create
    // and join transactions write a pointer for the organizer too, so the
    // docs behind it are a complete "my circles" set — the organized count
    // is derived client-side from the same snapshots. (The old second
    // source, a `circles` where organizerId == uid scan, is gone: rules
    // cannot inspect query `where` filters, so that list denies by design.)
    let latest = { joined: 0, organized: 0 };
    const recompute = () => setDaratCount(Math.max(latest.joined, latest.organized));
    const pointerUnsub = onSnapshot(
      collection(db, 'users', user.uid, 'circles'),
      async (snap) => {
        const ids = snap.docs.map((d) => d.id);
        if (ids.length === 0) {
          latest = { joined: 0, organized: 0 };
          recompute();
          return;
        }
        try {
          const docs = await Promise.all(ids.map((id) => getDoc(doc(db, 'circles', id))));
          const active = docs.filter(
            (s) => s.exists() && (s.data() as { status?: string }).status === 'active',
          );
          latest = {
            joined: active.length,
            organized: active.filter(
              (s) => (s.data() as { organizerId?: string }).organizerId === user.uid,
            ).length,
          };
        } catch (err) {
          console.warn('[profile] darat circle docs load failed', err);
        }
        recompute();
      },
      (err) => {
        console.warn('[profile] darat pointer snapshot failed', err);
      },
    );
    return () => {
      pointerUnsub();
    };
    // firestoreDb is module-level and won't change, so the effect only needs
    // to re-run when the user or their Pro state flips.
  }, [user?.uid, proForDarat]);
  const daratHint = !proForDarat
    ? m.darat.proGate.perk1
    : daratCount === null
      ? m.darat.title
      : t(m.darat.list.active, { count: daratCount });
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const monthIsClosed = month.periodStatus === 'closed';
  const canManageMonth = workspace === 'personal' || isOwner;
  const proUnlocked = isProFeatureUnlocked(isPro, workspace, household);
  // Profile is the member's own account page, so it is never blocked wholesale.
  // Individual entries that lead into a household area are gated instead.
  const canSeeIncome = canViewArea(TOOL_AREA.incomeSources);
  // Household management is a Pro feature: a free user in their personal
  // workspace gets no household entry at all. A member of someone else's
  // household keeps it — their access comes from the household, not a plan.
  const canManageHousehold = isPro || workspace === 'household';
  const canSeeMembers = canViewArea(TOOL_AREA.household);
  const canSeeAnalytics = canViewArea('analytics');
  const canSeeExpenses = canViewArea('expenses');
  const { places } = useMoneyPlaces(month);
  const theme = profile?.theme || 'system';
  const themeLabel = m.settings[theme];
  type HubItem = {
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
    icon: string;
    title: string;
    hint: string;
    /** Hidden when the member's household role excludes the area it opens. */
    hidden?: boolean;
  };

  const monthStartDate = month.periodStartDay;
  const preferenceHint = [
    currency,
    localeNames[language],
    themeLabel,
    monthStartDate
      ? t(p.hints.budgetStarts, {
          day: formatLocalizedDayOfMonth(monthStartDate, language, intlLocale),
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const groups: { label: string; items: HubItem[] }[] = [
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
        {
          onClick: () => setShowCloseConfirm(true),
          icon: 'lock_open',
          title: m.monthLock.close,
          hint: p.hints.closeMonth,
          hidden: !canManageMonth || monthIsClosed,
          disabled: !isMounted || syncState === 'failed' || syncState === 'conflict',
        },
      ],
    },
    {
      label: p.groups.workspace,
      items: [
        {
          href: '/dashboard/profile/workspace',
          icon: 'inventory_2',
          title: p.links.workspace,
          hint: p.hints.personalAndHousehold,
        },
        {
          href: '/dashboard/darat',
          icon: 'user_group',
          title: m.darat.shortTitle,
          hint: daratHint,
          // Pro-only feature, but the entry stays visible to free users so
          // they can discover it. The destination page shows the Pro gate;
          // the Pro upgrade modal opens from the page itself.
        },
        { href: '/dashboard/profile/pro', icon: 'workspace_premium', title: p.links.pro, hint: p.hints.planIncomeInsights },
        {
          href: proUnlocked ? '/dashboard/trends' : '/dashboard/profile/pro',
          icon: 'trending_up',
          title: p.pro.analyticsInsights,
          hint: p.pro.features.trends.description,
          hidden: !canSeeAnalytics,
        },
        {
          href: '/dashboard/courses',
          icon: 'scan_barcode',
          title: p.pro.features.courseScan.title,
          hint: p.pro.features.courseScan.description,
          hidden: !canSeeExpenses,
        },
        {
          onClick: proUnlocked ? openIncomeModal : openProModal,
          icon: 'payments',
          title: p.pro.manageIncomeSources,
          hint: p.pro.features.incomeSources.description,
          hidden: !canSeeIncome,
        },
        {
          href: '/dashboard/profile/household',
          icon: 'family_restroom',
          title: p.pro.manageHousehold,
          hint: p.pro.features.household.description,
          hidden: !canSeeMembers || !canManageHousehold,
        },
      ],
    },
    {
      label: p.groups.privacyAccount,
      items: [
        { href: '/dashboard/profile/reminders', icon: 'notifications_active', title: p.links.reminders, hint: p.hints.reminders },
        { href: '/dashboard/profile/security', icon: 'lock', title: p.links.security, hint: p.hints.security },
        { href: '/dashboard/profile/data', icon: 'database', title: p.links.data, hint: p.hints.exportImportDelete },
        { href: '/dashboard/profile/account', icon: 'manage_accounts', title: p.links.account, hint: p.hints.signOutDelete },
      ],
    },
  ];

  // Drop entries the member's household role excludes, then any group left
  // empty — an empty bordered section would read as a broken page.
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.hidden) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 pb-24">
      <ProfileIdentity />

      <div className="flex flex-col gap-6">
        {visibleGroups.map((group) => (
          <section key={group.label} className="flex flex-col gap-2">
            <h3 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-on-surface-variant">
              {group.label}
            </h3>
            <nav className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
              {group.items.map((item, index) => {
                const rowClass = `group flex w-full items-center justify-between gap-3 p-4 text-start transition-colors hover:bg-surface-container-high ${
                  index > 0 ? 'border-t border-outline-variant/30' : ''
                }`;
                const body = (
                  <>
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
                  </>
                );
                if (item.href) {
                  return (
                    <Link key={item.href} href={item.href} prefetch={true} className={rowClass}>
                      {body}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`${rowClass} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-container`}
                  >
                    {body}
                  </button>
                );
              })}
            </nav>
          </section>
        ))}
      </div>

      {canManageMonth && !monthIsClosed && (
        <ConfirmDialog
          isOpen={showCloseConfirm}
          onClose={() => setShowCloseConfirm(false)}
          onConfirm={closeCurrentMonth}
          title={m.monthLock.close}
          message={m.monthLock.closeConfirm}
          confirmLabel={m.monthLock.close}
        />
      )}
    </div>
  );
}
