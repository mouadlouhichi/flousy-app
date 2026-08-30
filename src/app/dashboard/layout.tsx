import type { Metadata } from 'next';
import { AppProviders } from '@/components/app-providers';
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your private SmartJib budgeting dashboard.',
  robots: {
    index: false,
    follow: false,
  },
};

// The dashboard renders per-request so the per-request CSP nonce (set by
// src/middleware.ts) can match the hydration scripts. Private/auth routes
// are never CDN-cached anyway, so this costs only the authenticated user.
export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </AppProviders>
  );
}
