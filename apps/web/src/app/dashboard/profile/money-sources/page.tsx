import type { Metadata } from 'next';
import { ProfileSubpage } from '@/components/dashboard/profile/profile-subpage';
import { MoneySourcesPanel } from '@/components/dashboard/profile/money-sources-panel';

export const metadata: Metadata = {
  title: 'Money Sources',
  robots: { index: false, follow: false },
};

export default function MoneySourcesPage() {
  return (
    <ProfileSubpage titleKey="moneySourcesTitle" descriptionKey="moneySourcesDescription">
      <MoneySourcesPanel />
    </ProfileSubpage>
  );
}
