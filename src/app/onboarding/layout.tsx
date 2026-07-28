import type { Metadata } from 'next';
import { AppProviders } from '@/components/app-providers';

export const metadata: Metadata = {
  title: 'Set up your budget',
  description: 'Set up your private Flousy budget.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
