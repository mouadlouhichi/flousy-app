'use client';

import { useState } from 'react';
import { SavingsTab } from '@/components/tabs/SavingsTab';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SavingsActivityEntry } from '@/lib/store';
import { useCurrency } from '@/lib/currency-context';

const placeLabel = (entry: SavingsActivityEntry | null): string => {
  if (entry?.place === 'home') return 'Home Cash';
  if (entry?.place === 'wallet') return 'Wallet';
  return 'Bank';
};

export function SavingsScreen() {
  const {
    goals,
    month,
    openSavingsModal,
    openSavingsEntryModal,
    handleDeleteSavingsEntry,
  } = useDashboard();
  const { workspace, canViewArea, canEditArea } = useHousehold();
  const { format } = useCurrency();
  const canView = workspace === 'personal' || canViewArea('savings');
  const canEdit = workspace === 'personal' || canEditArea('savings', true);
  const [pendingDelete, setPendingDelete] = useState<SavingsActivityEntry | null>(null);

  if (!canView) return <div className="rounded-3xl border border-outline-variant bg-surface-container p-8 text-center"><p className="text-sm font-bold text-on-surface">Savings is private</p><div className="mx-auto mt-4 h-16 max-w-sm rounded-xl bg-surface-variant blur-sm" /><p className="mt-4 text-xs text-on-surface-variant">Your household access does not include savings goals or balances.</p></div>;

  return (
    <>
      <SavingsTab
        goals={goals}
        month={month}
        canEdit={canEdit}
        onOpenCreateGoal={() => canEdit && openSavingsModal('create')}
        onOpenFundModal={(goal) => canEdit && openSavingsModal('fund', goal)}
        onOpenWithdrawModal={(goal) => canEdit && openSavingsModal('withdraw', goal)}
        onOpenEditGoal={(goal) => canEdit && openSavingsModal('edit', goal)}
        onEditDeposit={(entry) => canEdit && openSavingsEntryModal(entry)}
        onDeleteDeposit={(entry) => canEdit && setPendingDelete(entry)}
      />

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) handleDeleteSavingsEntry(pendingDelete.id);
          setPendingDelete(null);
        }}
        title={pendingDelete?.type === 'withdraw' ? 'Delete withdrawal?' : 'Delete deposit?'}
        message={
          pendingDelete?.type === 'withdraw'
            ? `This removes the ${format(pendingDelete.amount)} withdrawal from "${
                pendingDelete.goalName
              }" and takes the money back out of your ${placeLabel(pendingDelete)} balance.`
            : `This removes the ${format(pendingDelete?.amount || 0)} deposit for "${
                pendingDelete?.goalName || ''
              }" and puts the money back into your ${placeLabel(pendingDelete)} balance.`
        }
        confirmLabel="Delete"
        isDestructive
      />
    </>
  );
}
