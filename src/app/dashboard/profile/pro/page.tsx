import type { Metadata } from 'next';
import { ProfileSubpage } from '@/components/dashboard/profile/profile-subpage';
import { ProPanel } from '@/components/dashboard/profile/pro-panel';

export const metadata: Metadata = {
  title: 'Pro',
  robots: { index: false, follow: false },
};

export default function ProPage() {
  return (
    <ProfileSubpage titleKey="proTitle" descriptionKey="proDescription">
      <ProPanel />
    </ProfileSubpage>
  );
}
