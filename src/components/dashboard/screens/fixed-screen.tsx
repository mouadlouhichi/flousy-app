'use client';

import { FixedTab } from '@/components/tabs/FixedTab';
import { useDashboard } from '../dashboard-provider';
import { AreaRestricted } from '../area-restricted';
import { useHousehold } from '@/lib/household-context';
import { SCREEN_AREA } from '@/lib/household-rbac';

export function FixedScreen() {
  const { month, openFixedModal } = useDashboard();
  const { canViewArea, canEditArea } = useHousehold();
  const area = SCREEN_AREA.fixed!;
  if (!canViewArea(area)) return <AreaRestricted area={area} icon="event_repeat" />;

  return (
    <FixedTab
      month={month}
      onOpenAddModal={() => openFixedModal()}
      onEditBill={(bill) => openFixedModal(bill)}
      canEdit={canEditArea('fixedBills', true)}
    />
  );
}
