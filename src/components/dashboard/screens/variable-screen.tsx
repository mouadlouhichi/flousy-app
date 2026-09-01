'use client';

import { VariableTab } from '@/components/tabs/VariableTab';
import { useDashboard } from '../dashboard-provider';

export function VariableScreen() {
  const {
    month,
    openExpenseModal,
    openProModal,
    updateAndSaveMonth,
    handleUpdateProfile,
  } = useDashboard();

  return (
    <VariableTab
      month={month}
      onOpenAddModal={() => openExpenseModal()}
      onEditExpense={(exp) => openExpenseModal(exp)}
      onUpdateMonth={updateAndSaveMonth}
      onUpdateProfile={handleUpdateProfile}
      onOpenProModal={openProModal}
    />
  );
}
