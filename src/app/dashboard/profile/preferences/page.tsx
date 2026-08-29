import type { Metadata } from 'next';
import { ProfileSubpage } from '@/components/dashboard/profile/profile-subpage';
import { PreferencesPanel } from '@/components/dashboard/profile/preferences-panel';

export const metadata: Metadata = {
  title: 'Preferences',
  robots: { index: false, follow: false },
};

export default function PreferencesPage() {
  return (
    <ProfileSubpage title="Preferences" description="Currency, language, theme and the day your budget month starts.">
      <PreferencesPanel />
    </ProfileSubpage>
  );
}
