'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendsTab } from '@/components/tabs/TrendsTab';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { isProFeatureUnlocked } from '@/lib/household';

export function TrendsScreen() {
  const router = useRouter();
  const { month, trendsMonths, trendsLoading, profile, isPro, authLoading, openProModal } =
    useDashboard();
  const { workspace } = useHousehold();
  const proUnlocked = isProFeatureUnlocked(isPro, workspace);

  // Trends is a PRO feature: bounce users who don't have access back to the overview.
  useEffect(() => {
    if (!authLoading && !proUnlocked) {
      router.replace('/dashboard/profile/workspace');
    }
  }, [authLoading, proUnlocked, router]);

  if (authLoading || !proUnlocked) {
    return null;
  }

  return (
    <TrendsTab
      month={month}
      trendsMonths={trendsMonths}
      trendsLoading={trendsLoading}
      profile={profile}
      onOpenProModal={openProModal}
    />
  );
}
