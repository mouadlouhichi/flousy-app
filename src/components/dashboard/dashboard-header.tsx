'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { AppIcon } from '@/components/ui/app-icon';
import { BudgetAlerts } from '@/components/ui/BudgetAlerts';
import { InstallButton } from '@/components/pwa/install-button';
import { useDashboard } from './dashboard-provider';
import { DASHBOARD_NAV_ITEMS, getScreenIdFromPath } from './nav-items';

/** Main header bar: page title, month selector and action tools. */
export function DashboardHeader() {
  const pathname = usePathname();
  const {
    month,
    currentMonthKey,
    handlePrevMonth,
    handleNextMonth,
    openExpenseModal,
    openSettingsModal,
  } = useDashboard();

  const activeScreen = getScreenIdFromPath(pathname);
  const activeItem = DASHBOARD_NAV_ITEMS.find((item) => item.id === activeScreen);

  const monthLabel = (() => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'short' });
  })();

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
          {activeItem?.title ?? 'Dashboard Overview'}
        </h1>
      </div>

      {/* Center Month Selector */}
      <div className="flex items-center gap-0.5 sm:gap-1 bg-surface-container px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-outline-variant">
        <button
          onClick={handlePrevMonth}
          className="p-0.5 sm:p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <AppIcon name="chevron_left" className=" text-[16px] sm:text-[18px]" />
        </button>
        <span className="font-label-sm sm:font-label-lg text-label-sm sm:text-label-lg font-bold text-on-surface min-w-[32px] sm:min-w-[64px] text-center uppercase">
          {monthLabel}
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
        <InstallButton compact />

        <BudgetAlerts month={month} />

        <button
          onClick={() => openExpenseModal()}
          className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-full font-label-md font-bold hover:bg-accent-foreground shadow-xs transition-all"
        >
          <AppIcon name="add" className=" text-[18px]" />
          <span>New Transaction</span>
        </button>

        <button
          onClick={openSettingsModal}
          className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/60 rounded-xl transition-colors md:hidden"
          aria-label="Open Settings"
        >
          <AppIcon name="settings" className=" text-[22px]" />
        </button>
      </div>
    </header>
  );
}
