import type { Metadata } from 'next';
import { ProfileSubpage } from '@/components/dashboard/profile/profile-subpage';
import { DataPanel } from '@/components/dashboard/profile/data-panel';

export const metadata: Metadata = {
  title: 'Data',
  robots: { index: false, follow: false },
};

export default function DataPage() {
  return (
    <ProfileSubpage title="Data" description="Export a copy, import a CSV, or wipe budget data.">
      <DataPanel />
    </ProfileSubpage>
  );
}
