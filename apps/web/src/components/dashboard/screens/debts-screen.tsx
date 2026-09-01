'use client';

import { DebtsTab } from '@/components/tabs/DebtsTab';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { useLanguage } from '@/lib/i18n-context';

export function DebtsScreen() {
  const { month, openDebtModal } = useDashboard();
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

  return <DebtsTab month={month} onOpenDebtModal={() => canEdit && openDebtModal()} />;
}
