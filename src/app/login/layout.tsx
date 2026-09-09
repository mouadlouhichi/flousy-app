import type { Metadata } from 'next';
import { LoginProviders } from '@/components/login-providers';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to SmartJib or create a free account to start tracking your budget.',
  alternates: {
    canonical: '/login',
  },
  // This is the public account entry point linked from the landing page. Keep
  // it crawlable; only authenticated and onboarding screens are private.
  robots: {
    index: true,
    follow: true,
  },
};

// Static (prerendered) so the login → onboarding → dashboard flow is instant
// client-side navigation. See src/proxy.ts: these paths stay no-store.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <LoginProviders>{children}</LoginProviders>;
}
