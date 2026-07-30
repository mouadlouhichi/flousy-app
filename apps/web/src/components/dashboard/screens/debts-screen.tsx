'use client';

import { DebtsTab } from '@/components/tabs/DebtsTab';
import { useDashboard } from '../dashboard-provider';

export function DebtsScreen() {
  const { month, openDebtModal } = useDashboard();

  return <DebtsTab month={month} onOpenDebtModal={() => openDebtModal()} />;
}
