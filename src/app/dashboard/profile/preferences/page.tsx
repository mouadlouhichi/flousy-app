import type { Metadata } from 'next';
import { ProfileSubpage } from '@/components/dashboard/profile/profile-subpage';
import { PreferencesPanel } from '@/components/dashboard/profile/preferences-panel';

export const metadata: Metadata = {
  title: 'Preferences',
  robots: { index: false, follow: false },
};

export default function PreferencesPage() {
  return (
    <ProfileSubpage titleKey="preferencesTitle" descriptionKey="preferencesDescription">
      <PreferencesPanel />
    </ProfileSubpage>
  );
}
