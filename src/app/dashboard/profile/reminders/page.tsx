import type { Metadata } from 'next';
import { ProfileSubpage } from '@/components/dashboard/profile/profile-subpage';
import { RemindersPanel } from '@/components/dashboard/profile/reminders-panel';

export const metadata: Metadata = {
  title: 'Reminders',
  robots: { index: false, follow: false },
};

export default function RemindersPage() {
  return (
    <ProfileSubpage titleKey="remindersTitle" descriptionKey="remindersDescription">
      <RemindersPanel />
    </ProfileSubpage>
  );
}
