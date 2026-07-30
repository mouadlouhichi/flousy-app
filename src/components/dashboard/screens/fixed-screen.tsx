'use client';

import { FixedTab } from '@/components/tabs/FixedTab';
import { useDashboard } from '../dashboard-provider';

export function FixedScreen() {
  const { month, openFixedModal } = useDashboard();

  return (
    <FixedTab
      month={month}
      onOpenAddModal={() => openFixedModal()}
      onEditBill={(bill) => openFixedModal(bill)}
    />
  );
}
