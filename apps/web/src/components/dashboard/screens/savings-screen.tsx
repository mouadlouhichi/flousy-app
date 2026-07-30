'use client';

import { SavingsTab } from '@/components/tabs/SavingsTab';
import { useDashboard } from '../dashboard-provider';

export function SavingsScreen() {
  const { goals, openSavingsModal } = useDashboard();

  return (
    <SavingsTab
      goals={goals}
      onOpenCreateGoal={() => openSavingsModal('create')}
      onOpenFundModal={(goal) => openSavingsModal('fund', goal)}
      onOpenWithdrawModal={(goal) => openSavingsModal('withdraw', goal)}
      onOpenEditGoal={(goal) => openSavingsModal('edit', goal)}
    />
  );
}
