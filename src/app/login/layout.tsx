import type { Metadata } from 'next';
import { AppProviders } from '@/components/app-providers';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your SmartJib account.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
