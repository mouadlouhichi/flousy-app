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

// Per-request CSP nonce (see src/middleware.ts) requires dynamic rendering.
export const dynamic = 'force-dynamic';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
