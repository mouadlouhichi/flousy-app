import type { Metadata } from 'next';
import { ProfileSubpage } from '@/components/dashboard/profile/profile-subpage';
import { AccountPanel } from '@/components/dashboard/profile/account-panel';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <ProfileSubpage titleKey="accountTitle" descriptionKey="accountDescription">
      <AccountPanel />
    </ProfileSubpage>
  );
}
