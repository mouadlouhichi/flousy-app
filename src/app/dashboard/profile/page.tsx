import type { Metadata } from 'next';
import { ProfileScreen } from '@/components/dashboard/screens/profile-screen';

export const metadata: Metadata = {
  title: 'Profile & Account',
  description: 'Manage your SmartJib account, preferences and Pro features.',
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <ProfileScreen />;
}
