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

/**
 * The dashboard shell is prerendered (static) so in-app navigation between
 * screens is pure client-side: no server round-trip on every click. All user
 * data is fetched client-side after hydration, and `src/proxy.ts` marks
 * these paths `private, no-store` so nothing is cached at the CDN.
 *
 * (The per-request CSP nonce was removed in favour of an origin-based CSP on
 * every route — a per-request nonce forces dynamic rendering, which is what
 * made navigation feel slow.)
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </AppProviders>
  );
}
