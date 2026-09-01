'use client';

import { VariableTab } from '@/components/tabs/VariableTab';
import { useDashboard } from '../dashboard-provider';
import { AreaRestricted } from '../area-restricted';
import { useHousehold } from '@/lib/household-context';
import { SCREEN_AREA } from '@/lib/household-rbac';

export function VariableScreen() {
  const {
    month,
    openExpenseModal,
    openProModal,
    updateAndSaveMonth,
    handleUpdateProfile,
  } = useDashboard();
  const { canViewArea, canEditArea } = useHousehold();
  const area = SCREEN_AREA.variable!;
  if (!canViewArea(area)) return <AreaRestricted area={area} icon="receipt_long" />;

  return (
    <VariableTab
      month={month}
      onOpenAddModal={() => openExpenseModal()}
      onEditExpense={(exp) => openExpenseModal(exp)}
      onUpdateMonth={(next) => updateAndSaveMonth(next, 'settings')}
      onUpdateProfile={handleUpdateProfile}
      onOpenProModal={openProModal}
      canEdit={canEditArea('expenses', true)}
      canEditCategoryBudgets={canEditArea('settings')}
    />
  );
}
