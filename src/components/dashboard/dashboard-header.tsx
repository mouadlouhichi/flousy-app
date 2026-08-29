'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { AppIcon } from '@/components/ui/app-icon';
import { BudgetAlerts } from '@/components/ui/BudgetAlerts';
import { useHousehold } from '@/lib/household-context';
import { useDashboard } from './dashboard-provider';
import { DASHBOARD_NAV_ITEMS, getProfilePageTitle, getScreenIdFromPath } from './nav-items';
import { formatDayOfMonth, getSourcePeriod } from '@/lib/utils';

/** "2026-08-25" → { month: "Aug", day: "25" } (parsed locally, no UTC offset surprises). */
function formatPeriodParts(iso: string): { month: string; day: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day: date.toLocaleDateString('en-US', { day: 'numeric' }),
  };
}

/** Main header bar: page title, month selector and action tools. */
export function DashboardHeader() {
  const pathname = usePathname();
  const {
    month,
    user,
    profile,
    currentMonthKey,
    handlePrevMonth,
    handleNextMonth,
    openExpenseModal,
  } = useDashboard();

  const { workspace, canEditArea } = useHousehold();
  const canAddExpense = !!profile && (workspace === 'personal' || canEditArea('expenses', true));

  const activeScreen = getScreenIdFromPath(pathname);
  const activeItem = DASHBOARD_NAV_ITEMS.find((item) => item.id === activeScreen);
  const isProfileActive = activeScreen === 'profile';
  const userInitial = (profile?.displayName || user?.email)?.[0]?.toUpperCase() || '';

  const monthLabel = (() => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'short' });
  })();

  // When a monthly start date is configured, the navigator shows the budget
  // period itself (e.g. "AUG 25 → SEP 24") instead of a bare calendar month.
  const budgetPeriod = profile?.monthStartDate
    ? getSourcePeriod(currentMonthKey, profile.monthStartDate)
    : null;
  const periodStart = budgetPeriod ? formatPeriodParts(budgetPeriod.startDate) : null;
  const periodEnd = budgetPeriod ? formatPeriodParts(budgetPeriod.endDate) : null;

  return (
    <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur-md border-b border-surface-variant px-4 md:px-8 py-3 flex items-center justify-between">
      <div className="flex self-center gap-3 ">
        {/* Mobile Logo */}
        <div className="md:hidden flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="SmartJib logo"
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
          {getProfilePageTitle(pathname) ?? activeItem?.title ?? 'Dashboard Overview'}
        </h1>
      </div>

      {/* Center Month Selector */}
      <div
        className="flex items-center gap-0.5 sm:gap-1 bg-surface-container px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-outline-variant"
        title={
          profile?.monthStartDate
            ? `Custom budget month (starts on the ${formatDayOfMonth(profile.monthStartDate)})`
            : undefined
        }
      >
        <button
          onClick={handlePrevMonth}
          className="p-0.5 sm:p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <AppIcon name="chevron_left" className=" text-[16px] sm:text-[18px]" />
        </button>
        <span className="flex min-w-0 items-center justify-center gap-1 font-label-sm sm:font-label-lg text-label-sm sm:text-label-lg font-bold text-on-surface sm:min-w-[64px] text-center uppercase">
          {budgetPeriod && periodStart && periodEnd ? (
            <>
              <span className="whitespace-nowrap">{periodStart.month}</span>
              <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/45 bg-primary/10 px-1.5 py-0.5">
                <AppIcon
                  name="loop"
                  className="shrink-0 text-[12px] text-primary sm:text-[14px]"
                  aria-label="Custom budget month"
                />
                <span>{periodStart.day}</span>
              </span>
              <span className="hidden whitespace-nowrap sm:inline">
                → {periodEnd.month} {periodEnd.day}
              </span>
            </>
          ) : (
            monthLabel
          )}
        </span>
        <button
          onClick={handleNextMonth}
          className="p-0.5 sm:p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
          aria-label="Next month"
        >
          <AppIcon name="chevron_right" className=" text-[16px] sm:text-[18px]" />
        </button>
      </div>

      {/* Header Action Tools */}
      <div className="flex items-center gap-2">
        <BudgetAlerts month={month} />

        {canAddExpense && <button
          onClick={() => openExpenseModal()}
          className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-full font-label-md font-bold hover:bg-accent-foreground shadow-xs transition-all"
        >
          <AppIcon name="add" className=" text-[18px]" />
          <span>New Transaction</span>
        </button>}

        {/* Profile entry point (mobile). Replaces the old settings gear so the
            bottom nav can keep all 6 destinations without overflowing. */}
        <Link
          href="/dashboard/profile"
          prefetch={false}
          aria-label="Open profile and account"
          title="Profile & Account"
          aria-current={isProfileActive ? 'page' : undefined}
          className={`md:hidden flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
            isProfileActive
              ? 'bg-primary text-on-primary'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          }`}
        >
          {userInitial ? (
            <span>{userInitial}</span>
          ) : (
            <AppIcon name="person" className="text-[20px]" />
          )}
        </Link>
      </div>
    </header>
  );
}
