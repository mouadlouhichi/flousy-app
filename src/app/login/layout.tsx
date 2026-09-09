import type { Metadata } from 'next';
import { LoginProviders } from '@/components/login-providers';
import { OG_IMAGE, OG_LOCALE, SITE_NAME, TWITTER_CARD } from '@/lib/seo';

const title = 'Sign in · SmartJib';
const description = 'Sign in to SmartJib or create a free account to start tracking your budget.';

export const metadata: Metadata = {
  title: 'Sign in',
  description,
  alternates: {
    canonical: '/login',
  },
  // This is the public account entry point linked from the landing page. Keep
  // it crawlable; only authenticated and onboarding screens are private.
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title,
    description,
    url: '/login',
    siteName: SITE_NAME,
    type: 'website',
    locale: OG_LOCALE,
    images: [OG_IMAGE],
  },
  twitter: {
    card: TWITTER_CARD,
    title,
    description,
    images: [OG_IMAGE.url],
  },
};

// Static (prerendered) so the login → onboarding → dashboard flow is instant
// client-side navigation. See src/proxy.ts: these paths stay no-store.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <LoginProviders>{children}</LoginProviders>;
}
