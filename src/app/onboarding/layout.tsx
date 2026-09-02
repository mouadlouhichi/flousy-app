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

// Static (prerendered) so the login → onboarding → dashboard flow is instant
// client-side navigation. See src/proxy.ts: these paths stay no-store.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
