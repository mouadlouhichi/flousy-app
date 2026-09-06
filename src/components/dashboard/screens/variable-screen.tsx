'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VariableTab } from '@/components/tabs/VariableTab';
import { useDashboard } from '../dashboard-provider';
import { AreaRestricted } from '../area-restricted';
import { useHousehold } from '@/lib/household-context';
import { SCREEN_AREA } from '@/lib/household-rbac';

export function VariableScreen() {
  const {
    month,
    openExpenseModal,
    openExpenseModalWithPrefill,
    openProModal,
    updateAndSaveMonth,
    handleUpdateProfile,
    handleSetCategoryEnvelope,
  } = useDashboard();
  const { canViewArea, canEditArea } = useHousehold();
  const area = SCREEN_AREA.variable!;
  const router = useRouter();
  const params = useSearchParams();
  const handledRef = useRef(false);

  // Home-screen shortcut (`?action=expense`) and Android share target
  // (`?text=…`) both open the add-expense sheet once, then clean the URL so a
  // refresh does not reopen it.
  useEffect(() => {
    if (handledRef.current) return;
    const action = params.get('action');
    const shared = params.get('text') || params.get('title');
    if (action !== 'expense' && !shared) return;
    handledRef.current = true;
    if (canEditArea('expenses', true)) {
      if (shared) {
        const amountMatch = /(\d+(?:[.,]\d{1,2})?)/.exec(shared);
        openExpenseModalWithPrefill({
          name: shared.replace(/\s+/g, ' ').trim().slice(0, 80),
          amount: amountMatch ? Number(amountMatch[1].replace(',', '.')) : undefined,
        });
      } else {
        openExpenseModal();
      }
    }
    router.replace('/dashboard/variable');
  }, [params, canEditArea, openExpenseModal, openExpenseModalWithPrefill, router]);

  if (!canViewArea(area)) return <AreaRestricted area={area} icon="receipt_long" />;

  return (
    <VariableTab
      month={month}
      onOpenAddModal={() => openExpenseModal()}
      onEditExpense={(exp) => openExpenseModal(exp)}
      onUpdateMonth={(next) => updateAndSaveMonth(next, 'settings')}
      onUpdateProfile={handleUpdateProfile}
      onOpenProModal={openProModal}
      onSetCategoryEnvelope={canEditArea('settings') ? handleSetCategoryEnvelope : undefined}
      canEdit={canEditArea('expenses', true)}
      canEditCategoryBudgets={canEditArea('settings')}
    />
  );
}
