'use client';

import { useRouter } from 'next/navigation';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { useDashboard } from '../dashboard-provider';
import { AreaRestricted } from '../area-restricted';
import { useHousehold } from '@/lib/household-context';
import { SCREEN_AREA } from '@/lib/household-rbac';
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
    openSavingsEntryModal,
    handleUpdateTotalBudget,
    handleUpdateStrategy,
  } = useDashboard();
  const { canViewArea } = useHousehold();
  const area = SCREEN_AREA.overview!;
  // The summary screen is the `dashboard` area. Individual figures inside it
  // are additionally gated by the area that owns each number (balances,
  // income, expenses, savings) — see OverviewTab.
  if (!canViewArea(area)) return <AreaRestricted area={area} icon="house" />;

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
      onOpenEditSavings={(entry) => openSavingsEntryModal(entry)}
    />
  );
}
