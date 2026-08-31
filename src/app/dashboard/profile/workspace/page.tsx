import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProfileSubpage } from '@/components/dashboard/profile/profile-subpage';
import { WorkspacePanel } from '@/components/dashboard/profile/workspace-panel';

export const metadata: Metadata = {
  title: 'Workspace',
  robots: { index: false, follow: false },
};

export default function WorkspacePage() {
  return (
    <ProfileSubpage titleKey="workspaceTitle" descriptionKey="workspaceDescription">
      <WorkspacePanel />
    </ProfileSubpage>
  );
}
