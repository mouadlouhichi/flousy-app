'use client';

import { SavingsTab } from '@/components/tabs/SavingsTab';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';

export function SavingsScreen() {
  const {
    goals,
    month,
    openSavingsModal,
    openSavingsEntryModal,
  } = useDashboard();
  const { workspace, canViewArea, canEditArea } = useHousehold();
  const canView = workspace === 'personal' || canViewArea('savings');
  const canEdit = workspace === 'personal' || canEditArea('savings', true);

  if (!canView) return <div className="rounded-3xl border border-outline-variant bg-surface-container p-8 text-center"><p className="text-sm font-bold text-on-surface">Savings is private</p><div className="mx-auto mt-4 h-16 max-w-sm rounded-xl bg-surface-variant blur-sm" /><p className="mt-4 text-xs text-on-surface-variant">Your household access does not include savings goals or balances.</p></div>;

  return (
    <SavingsTab
      goals={goals}
      month={month}
      canEdit={canEdit}
      onOpenCreateGoal={() => canEdit && openSavingsModal('create')}
      onOpenFundModal={(goal) => canEdit && openSavingsModal('fund', goal)}
      onOpenWithdrawModal={(goal) => canEdit && openSavingsModal('withdraw', goal)}
      onOpenEditGoal={(goal) => canEdit && openSavingsModal('edit', goal)}
      onEditDeposit={(entry) => canEdit && openSavingsEntryModal(entry)}
    />
  );
}
