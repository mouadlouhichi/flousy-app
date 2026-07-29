import type { Metadata, Viewport } from 'next';
import { headers, cookies } from 'next/headers';
import { Instrument_Sans, JetBrains_Mono, Cairo } from 'next/font/google';
import { InstallBanner } from '@/components/pwa/install-banner';
import { InstallPromptCapture } from '@/components/pwa/install-prompt-capture';
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar';
import { LightLanguageProvider } from '@/lib/i18n-light';
import { AppProviders } from '@/components/app-providers';
import FirebaseAnalytics from '@/components/FirebaseAnalytics';
import { Suspense } from 'react';
import { SITE_URL } from '@/lib/seo';
import { LANG_COOKIE, isValidLocale, isRTL } from '@/lib/i18n';
import '../index.css';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});

const cairoArabic = Cairo({
  subsets: ['arabic'],
  variable: '--font-arabic',
  weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
});

// Required for nonce-based CSP (src/middleware.ts): a per-request nonce
// can only match the rendered HTML if the page is rendered per-request,
// not statically at build time.
export const dynamic = 'force-dynamic';


export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Flousy - Free Private Budget Tracker & Money Manager App',
    template: '%s · Flousy',
  },
  description:
    'Flousy is a private budget tracker for needs, wants, and savings that separately tracks money in your bank, home, and wallet—without bank connections.',
  applicationName: 'Flousy',
  authors: [{ name: 'Flousy Team' }],
  creator: 'Flousy Team',
  publisher: 'Flousy',
  keywords: [
    'budget tracker',
    'expense manager',
    'private budgeting',
    'PWA',
    'no bank connection',
    'needs wants savings budget',
    'money place tracking',
    'budgeting',
    'flousy',
    'money',
    'free',
    'dirham',
    'bank',
    'mad',
    'start',
    'budgeting styles',
    'start budgeting'
  ],
  generator: 'Next.js',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Flousy',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#00685f',
  colorScheme: 'light dark',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers();
  const cookieStore = await cookies();
  const langCookie = cookieStore.get(LANG_COOKIE)?.value;
  const locale = isValidLocale(langCookie) ? langCookie : 'en';
  const dir = isRTL(locale) ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${jetbrainsMono.variable} ${cairoArabic.variable}`}
    >
      <head>
        <InstallPromptCapture />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased">
        <Suspense fallback={null}>
          <FirebaseAnalytics />
        </Suspense>
        <LightLanguageProvider>
          <AppProviders>
            {children}
          </AppProviders>
        </LightLanguageProvider>
        <InstallBanner />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
