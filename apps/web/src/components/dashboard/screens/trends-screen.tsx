'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendsTab } from '@/components/tabs/TrendsTab';
import { useDashboard } from '../dashboard-provider';

export function TrendsScreen() {
  const router = useRouter();
  const { month, trendsMonths, trendsLoading, profile, isPro, authLoading, openProModal } =
    useDashboard();

  // Trends is a PRO-only screen: bounce free users back to the overview.
  useEffect(() => {
    if (!authLoading && !isPro) {
      router.replace('/dashboard');
    }
  }, [authLoading, isPro, router]);

  if (authLoading || !isPro) {
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
