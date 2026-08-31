'use client';

import { useSearchParams } from 'next/navigation';
import { useDashboard } from '../dashboard-provider';
import { HouseholdPanel } from './household-panel';

export function HouseholdManagePage() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('invite') || undefined;
  const { month, openProModal } = useDashboard();

  return (
    <HouseholdPanel
      onOpenPro={openProModal}
      month={month}
      initialInviteCode={inviteCode}
    />
  );
}
