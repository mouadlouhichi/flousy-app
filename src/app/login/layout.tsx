import type { Metadata } from 'next';
import { LoginProviders } from '@/components/app-providers';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your SmartJib account.',
  robots: {
    index: false,
    follow: false,
  },
};

// Static (prerendered) so the login → onboarding → dashboard flow is instant
// client-side navigation. See src/proxy.ts: these paths stay no-store.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <LoginProviders>{children}</LoginProviders>;
}
