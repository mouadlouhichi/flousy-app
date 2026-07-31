'use client';

import { DebtsTab } from '@/components/tabs/DebtsTab';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';

export function DebtsScreen() {
  const { month, openDebtModal } = useDashboard();
  const { workspace, canViewArea, canEditArea } = useHousehold();
  const canView = workspace === 'personal' || canViewArea('debts');
  const canEdit = workspace === 'personal' || canEditArea('debts', true);
  if (!canView) return <div className="rounded-3xl border border-outline-variant bg-surface-container p-8 text-center"><p className="text-sm font-bold text-on-surface">Debts are private</p><div className="mx-auto mt-4 h-16 max-w-sm rounded-xl bg-surface-variant blur-sm" /><p className="mt-4 text-xs text-on-surface-variant">Your household access does not include debts or credits.</p></div>;

  return <DebtsTab month={month} onOpenDebtModal={() => canEdit && openDebtModal()} />;
}
