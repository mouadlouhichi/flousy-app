import type { Metadata } from 'next';
import { AppProviders } from '@/components/app-providers';

export const metadata: Metadata = {
  title: 'Set up your budget',
  description: 'Set up your private SmartJib budget.',
  robots: {
    index: false,
    follow: false,
  },
};

// Per-request CSP nonce (see src/middleware.ts) requires dynamic rendering.
export const dynamic = 'force-dynamic';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
