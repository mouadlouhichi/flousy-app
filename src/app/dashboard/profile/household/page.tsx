import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProfileSubpage } from '@/components/dashboard/profile/profile-subpage';
import { HouseholdManagePage } from '@/components/dashboard/profile/household-manage-page';

export const metadata: Metadata = {
  title: 'Household',
  robots: { index: false, follow: false },
};

export default function HouseholdPage() {
  return (
    <ProfileSubpage titleKey="householdTitle" descriptionKey="householdDescription">
      <Suspense fallback={null}>
        <HouseholdManagePage />
      </Suspense>
    </ProfileSubpage>
  );
}
