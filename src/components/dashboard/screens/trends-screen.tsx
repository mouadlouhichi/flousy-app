'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendsTab } from '@/components/tabs/TrendsTab';
import { useDashboard } from '../dashboard-provider';
import { AreaRestricted } from '../area-restricted';
import { useHousehold } from '@/lib/household-context';
import { isProFeatureUnlocked } from '@/lib/household';
import { SCREEN_AREA } from '@/lib/household-rbac';

export function TrendsScreen() {
  const router = useRouter();
  const { month, trendsMonths, trendsLoading, profile, isPro, authLoading, openProModal } =
    useDashboard();
  const { workspace, household, canViewArea } = useHousehold();
  const proUnlocked = isProFeatureUnlocked(isPro, workspace, household);
  const area = SCREEN_AREA.trends!;
  // Analytics is an RBAC area of its own: the individual cards inside the tab
  // are additionally filtered by the area that owns their numbers.
  const canSeeAnalytics = canViewArea(area);

  // Trends is a PRO feature: bounce users who don't have access back to the overview.
  useEffect(() => {
    if (!authLoading && !proUnlocked) {
      router.replace('/dashboard/profile/workspace');
    }
  }, [authLoading, proUnlocked, router]);

  if (authLoading || !proUnlocked) {
    return null;
  }

  if (!canSeeAnalytics) {
    return <AreaRestricted area={area} icon="trending_up" />;
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
