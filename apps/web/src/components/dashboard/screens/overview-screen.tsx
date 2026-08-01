'use client';

import { useRouter } from 'next/navigation';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { useDashboard } from '../dashboard-provider';
import { DASHBOARD_NAV_ITEMS } from '../nav-items';

const TAB_ROUTES: Record<string, string> = Object.fromEntries(
  DASHBOARD_NAV_ITEMS.map((item) => [item.id, item.href]),
);

export function OverviewScreen() {
  const router = useRouter();
  const {
    month,
    goals,
    openExpenseModal,
    openMoveMoneyModal,
    openEditMoneyPlaces,
    handleUpdateTotalBudget,
    handleUpdateStrategy,
  } = useDashboard();

  return (
    <OverviewTab
      month={month}
      goals={goals}
      onOpenExpenseModal={() => openExpenseModal()}
      onOpenMoveMoneyModal={openMoveMoneyModal}
      onOpenEditExpense={(exp) => openExpenseModal(exp)}
      onSelectTab={(tab) => {
        const href = TAB_ROUTES[tab];
        if (href) router.push(href);
      }}
      onUpdateTotalBudget={handleUpdateTotalBudget}
      onEditMoneyPlaces={openEditMoneyPlaces}
      onUpdateStrategy={handleUpdateStrategy}
    />
  );
}
