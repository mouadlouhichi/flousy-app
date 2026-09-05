'use client';

import { DebtsTab } from '@/components/tabs/DebtsTab';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { useLanguage } from '@/lib/i18n-context';
import { deleteDebtPayment, recordDebtPayment, type DebtPayment } from '@/lib/store';
import { DebtPayoffPlanner } from '../debt-payoff-planner';

export function DebtsScreen() {
  const { month, openDebtModal, updateAndSaveMonth, user, proUnlocked, openProModal } = useDashboard();
  const { workspace, canViewArea, canEditArea } = useHousehold();
  const { messages: m } = useLanguage();
  const canView = workspace === 'personal' || canViewArea('debts');
  const canEdit = workspace === 'personal' || canEditArea('debts', true);
  if (!canView) return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container p-8 text-center">
      <p className="text-sm font-bold text-on-surface">{m.household.debtsPrivateTitle}</p>
      <div className="mx-auto mt-4 h-16 max-w-sm rounded-xl bg-surface-variant blur-sm" />
      <p className="mt-4 text-xs text-on-surface-variant">{m.household.debtsPrivateDescription}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
    <DebtPayoffPlanner month={month} unlocked={proUnlocked} onUpgrade={openProModal} />
    <DebtsTab
      month={month}
      canEdit={canEdit}
      onOpenDebtModal={() => canEdit && openDebtModal()}
      onEditDebt={(debt) => canEdit && openDebtModal(debt)}
      onRecordPayment={(debtId: string, payment: DebtPayment) => {
        if (!canEdit) return;
        updateAndSaveMonth(recordDebtPayment(month, debtId, {
          ...payment,
          createdByUserId: user?.uid,
        }), 'debts');
      }}
      onDeletePayment={(debtId, paymentId) => {
        if (!canEdit) return;
        updateAndSaveMonth(deleteDebtPayment(month, debtId, paymentId), 'debts');
      }}
    />
    </div>
  );
}
