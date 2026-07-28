import type { Metadata, Viewport } from 'next';
import { headers, cookies } from 'next/headers';
import localFont from 'next/font/local';
import { InstallBanner } from '@/components/pwa/install-banner';
import { InstallPromptCapture } from '@/components/pwa/install-prompt-capture';
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar';
import { LightLanguageProvider } from '@/lib/i18n-light';
import { SITE_URL } from '@/lib/seo';
import { LANG_COOKIE, isValidLocale, isRTL } from '@/lib/i18n';
import '../index.css';

// Fonts are self-hosted (files in ./fonts) rather than pulled from Google
// Fonts at build time: `next/font/google` needs network access to
// fonts.googleapis.com during `next build`, and when that fetch fails the
// build either dies or silently emits a fallback, which is how the app ended
// up rendering system-ui instead of Instrument Sans.
const instrumentSans = localFont({
  src: [
    {
      path: './fonts/instrument-sans-latin-wght-normal.woff2',
      weight: '400 700',
      style: 'normal',
    },
    {
      path: './fonts/instrument-sans-latin-ext-wght-normal.woff2',
      weight: '400 700',
      style: 'normal',
    },
    {
      path: './fonts/instrument-sans-latin-wght-italic.woff2',
      weight: '400 700',
      style: 'italic',
    },
    {
      path: './fonts/instrument-sans-latin-ext-wght-italic.woff2',
      weight: '400 700',
      style: 'italic',
    },
  ],
  variable: '--font-instrument',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'sans-serif'],
});

const jetbrainsMono = localFont({
  src: [
    {
      path: './fonts/jetbrains-mono-latin-wght-normal.woff2',
      weight: '100 800',
      style: 'normal',
    },
    {
      path: './fonts/jetbrains-mono-latin-ext-wght-normal.woff2',
      weight: '100 800',
      style: 'normal',
    },
  ],
  variable: '--font-jetbrains',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
});

// Required for nonce-based CSP (src/middleware.ts): a per-request nonce
// can only match the rendered HTML if the page is rendered per-request,
// not statically at build time.
export const dynamic = 'force-dynamic';


export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Flousy – Private Budget Tracker',
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
      className={`${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <InstallPromptCapture />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="font-sans antialiased">
        <LightLanguageProvider>
          {children}
        </LightLanguageProvider>
        <InstallBanner />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
