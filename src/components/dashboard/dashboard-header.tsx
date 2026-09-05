'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { AppIcon } from '@/components/ui/app-icon';
import { BudgetAlerts } from '@/components/ui/BudgetAlerts';
import { useHousehold } from '@/lib/household-context';
import { resolveProfileAvatarSource } from '@/lib/profile-avatar';
import { resolveProEntitlement } from '@/lib/pro-features';
import { useDashboard } from './dashboard-provider';
import { ProfileAvatar } from './profile-avatar';
import {
  DASHBOARD_NAV_ITEMS,
  getLocalizedNavTitle,
  getLocalizedProfilePageTitle,
  getScreenIdFromPath,
} from './nav-items';
import { getSourcePeriod } from '@/lib/utils';
import { formatLocalizedDayOfMonth } from '@/lib/localized-labels';
import { useLanguage } from '@/lib/i18n-context';

/** Format a custom budget-period endpoint in the active interface locale. */
function formatPeriodParts(iso: string, intlLocale: string): { month: string; day: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    month: date.toLocaleDateString(intlLocale, { month: 'short' }),
    day: new Intl.NumberFormat(intlLocale).format(date.getDate()),
  };
}

/** Main header bar: page title, month selector and action tools. */
export function DashboardHeader() {
  const pathname = usePathname();
  const { messages: m, language, intlLocale, isRTL } = useLanguage();
  const {
    month,
    goals,
    user,
    profile,
    currentMonthKey,
    handlePrevMonth,
    handleNextMonth,
    canGoPrevMonth,
    openExpenseModal,
    isMounted,
    syncState,
    pendingMutations,
    retrySync,
  } = useDashboard();

  const { workspace, canEditArea } = useHousehold();
  const monthIsClosed = month.periodStatus === 'closed';
  const canAddExpense = !monthIsClosed && !!profile && (workspace === 'personal' || canEditArea('expenses', true));

  const activeScreen = getScreenIdFromPath(pathname);
  const activeItem = DASHBOARD_NAV_ITEMS.find((item) => item.id === activeScreen);
  const isProfileActive = activeScreen === 'profile';
  const userInitial = (profile?.displayName || user?.email)?.[0]?.toUpperCase() || '';
  const avatarSrc = resolveProfileAvatarSource(profile?.avatarUrl, user?.photoURL);

  // The whole dashboard is prerendered at build time, so any date-derived
  // label computed during the first render is the BUILD date on the server and
  // today on the client — a hydration mismatch that shows the wrong month for
  // a frame (and, at a month boundary, permanently until the next click).
  // `isMounted` keeps the server and first client render identical.
  const monthLabel = !isMounted
    ? ''
    : (() => {
        const [y, m] = currentMonthKey.split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        return d.toLocaleDateString(intlLocale, { month: 'short' });
      })();

  // When a monthly start date is configured, the navigator shows the budget
  // period itself (e.g. "AUG 25 → SEP 24") instead of a bare calendar month.
  const budgetStartDay = month.periodStartDay;
  const budgetPeriod = isMounted && budgetStartDay && budgetStartDay > 1
    ? getSourcePeriod(currentMonthKey, budgetStartDay)
    : null;
  const periodStart = budgetPeriod ? formatPeriodParts(budgetPeriod.startDate, intlLocale) : null;
  const periodEnd = budgetPeriod ? formatPeriodParts(budgetPeriod.endDate, intlLocale) : null;

  // Tonal step above the page (container-low) with a soft drop shadow so the
  // bar stays legible over scrolled content instead of blending into it.
  return (
    <header className="sticky top-0 z-20 bg-surface-container-low/85 backdrop-blur-xl border-b border-outline-variant/40 shadow-[0_1px_16px_-6px_rgba(23,29,28,0.15)] px-4 md:px-8 py-3 flex items-center justify-between">
      <div className="flex self-center gap-3 ">
        {/* Mobile Logo */}
        <div className="md:hidden flex items-center gap-2">
          <Image
            src="/logo.png"
            alt={m.common.appName}
            width={26}
            height={28}
            className="object-contain"
            priority
          />
          <span className="font-headline-sm text-headline-sm text-primary font-extrabold tracking-tight">
            SmartJib
          </span>
        </div>

        {/* Desktop Page Title */}
        <h1 className="hidden md:block font-headline-md text-headline-md font-extrabold text-on-surface capitalize">
          {getLocalizedProfilePageTitle(pathname, m) ?? (activeItem ? getLocalizedNavTitle(activeItem, m) : m.navigation.dashboardOverview)}
        </h1>
      </div>

      {/* Center Month Selector */}
      <div
        className="flex items-center gap-0.5 sm:gap-1 bg-surface-container px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-outline-variant"
        title={
          budgetStartDay && budgetStartDay > 1
            ? `${m.navigation.customBudgetMonth} (${formatLocalizedDayOfMonth(budgetStartDay, language, intlLocale)})`
            : undefined
        }
      >
        <button
          onClick={handlePrevMonth}
          className="relative p-0.5 sm:p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
          aria-label={m.navigation.previousMonth}
          title={canGoPrevMonth ? undefined : m.insights.historyLockedTitle}
        >
          <AppIcon name={isRTL ? 'chevron_right' : 'chevron_left'} className=" text-[16px] sm:text-[18px]" />
          {!canGoPrevMonth && (
            <AppIcon name="lock" className="absolute -end-0.5 -top-0.5 text-[10px] text-primary" />
          )}
        </button>
        <span className="flex min-w-0 items-center justify-center gap-1 font-label-sm sm:font-label-lg text-label-sm sm:text-label-lg font-bold text-on-surface sm:min-w-[64px] text-center uppercase">
          {budgetPeriod && periodStart && periodEnd ? (
            <>
              {/* Flex alignment keeps the day badge from lifting above the date text. */}
              <span className="hidden items-center gap-1 whitespace-nowrap sm:inline-flex">
                <span>{periodStart.month}</span>
                <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/45 bg-primary/10 px-1.5 py-0.5">
                  <AppIcon
                    name="loop"
                    className="shrink-0 text-[14px] text-primary"
                    aria-label={m.navigation.customBudgetMonth}
                  />
                  <span>{periodStart.day}</span>
                </span>
                <span>→</span>
                <span>{periodEnd.month} {periodEnd.day}</span>
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap sm:hidden">
                <span>{periodEnd.month}</span>
                <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/45 bg-primary/10 px-1.5 py-0.5">
                  <AppIcon
                    name="loop"
                    className="shrink-0 text-[12px] text-primary"
                    aria-label={m.navigation.customBudgetMonth}
                  />
                  <span>{periodEnd.day}</span>
                </span>
              </span>
            </>
          ) : (
            monthLabel
          )}
        </span>
        <button
          onClick={handleNextMonth}
          className="p-0.5 sm:p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
          aria-label={m.navigation.nextMonth}
        >
          <AppIcon name={isRTL ? 'chevron_left' : 'chevron_right'} className=" text-[16px] sm:text-[18px]" />
        </button>
      </div>

      {/* Header Action Tools */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={syncState === 'failed' ? retrySync : undefined}
          disabled={syncState !== 'failed'}
          className={`hidden items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold sm:flex ${
            syncState === 'saved' || syncState === 'local'
              ? 'bg-primary/10 text-primary'
              : syncState === 'pending'
                ? 'bg-tertiary-container text-on-tertiary-container'
                : 'bg-error/10 text-error'
          }`}
          title={syncState === 'failed' ? m.sync.retry : m.sync[syncState]}
        >
          <AppIcon
            name={syncState === 'saved' ? 'cloud_done' : syncState === 'pending' ? 'cloud_upload' : syncState === 'local' ? 'devices' : 'cloud_off'}
            className={`text-[14px] ${syncState === 'pending' ? 'animate-pulse' : ''}`}
          />
          <span>{m.sync[syncState]}</span>
          {pendingMutations > 0 && <span>({pendingMutations})</span>}
        </button>
        <BudgetAlerts
          month={month}
          goals={goals}
          entitlement={
            profile
              ? resolveProEntitlement(profile)
              : null
          }
        />

        <Link
          href="/dashboard/search"
          prefetch={true}
          aria-label={m.search.open}
          title={m.search.title}
          aria-current={activeScreen === 'search' ? 'page' : undefined}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            activeScreen === 'search' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant'
          }`}
        >
          <AppIcon name="search" className="text-[18px]" />
        </Link>

        {canAddExpense && <button
          onClick={() => openExpenseModal()}
          className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-full font-label-md font-bold hover:bg-accent-foreground shadow-xs transition-all"
        >
          <AppIcon name="add" className=" text-[18px]" />
          <span>{m.navigation.newTransaction}</span>
        </button>}

        {/* Profile entry point (mobile). Replaces the old settings gear so the
            bottom nav can keep all 6 destinations without overflowing. */}
        <Link
          href="/dashboard/profile"
          prefetch={true}
          aria-label={m.navigation.openProfileAccount}
          title={m.navigation.profileAccount}
          aria-current={isProfileActive ? 'page' : undefined}
          className={`group md:hidden flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
            isProfileActive
              ? 'bg-primary text-on-primary'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          }`}
        >
          <ProfileAvatar
            src={avatarSrc}
            initial={userInitial || 'M'}
            alt=""
            className="size-full"
            fallbackClassName={
              isProfileActive
                ? 'bg-primary text-on-primary'
                : 'bg-primary/10 text-primary group-hover:bg-primary/20'
            }
          />
        </Link>
      </div>
    </header>
  );
}
