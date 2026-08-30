import type { Metadata } from 'next';
import { ProfileSubpage } from '@/components/dashboard/profile/profile-subpage';
import { AccountPanel } from '@/components/dashboard/profile/account-panel';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <ProfileSubpage title="Account" description="Sign out or permanently delete your SmartJib account.">
      <AccountPanel />
    </ProfileSubpage>
  );
}
