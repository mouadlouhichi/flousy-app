import type { Metadata } from 'next';
import { ProfileSubpage } from '@/components/dashboard/profile/profile-subpage';
import { SecurityPanel } from '@/components/dashboard/profile/security-panel';

export const metadata: Metadata = {
  title: 'Security',
  robots: { index: false, follow: false },
};

export default function SecurityPage() {
  return (
    <ProfileSubpage titleKey="securityTitle" descriptionKey="securityDescription">
      <SecurityPanel />
    </ProfileSubpage>
  );
}
