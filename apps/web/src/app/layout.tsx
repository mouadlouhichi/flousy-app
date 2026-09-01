import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { InstallBanner } from '@/components/pwa/install-banner';
import { InstallPromptCapture } from '@/components/pwa/install-prompt-capture';
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar';
import { LightLanguageProvider } from '@/lib/i18n-light';
import { LocalizedDocumentTitle } from '@/components/localized-document-title';
import { SITE_URL } from '@/lib/seo';
import '../index.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/cairo/wght.css';

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
  ],
  variable: '--font-instrument',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'SmartJib - Free Private Budget Tracker & Money Manager App',
    template: '%s · SmartJib',
  },
  description:
    'SmartJib is a private budget tracker for needs, wants, and savings that separately tracks money in your bank, home, and wallet—without bank connections.',
  applicationName: 'SmartJib',
  authors: [{ name: 'SmartJib Team' }],
  creator: 'SmartJib Team',
  publisher: 'SmartJib',
  keywords: [
    'budget tracker',
    'expense manager',
    'private budgeting',
    'PWA',
    'no bank connection',
    'needs wants savings budget',
    'money place tracking',
    'budgeting',
    'smartjib',
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
    title: 'SmartJib',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' },
      // Legacy compat - same assets under old names
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#00685f',
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  // iOS Safari auto-zooms focused inputs under 16px; cap scale so tapping a
  // field never jumps the whole page. Form controls are also ≥16px.
  maximumScale: 1,
};

/**
 * This layout is intentionally static (no headers()/cookies() await, no
 * force-dynamic). EVERY page — including the authenticated app routes — is
 * rendered once at build time, so in-app navigation is a pure client-side
 * route change (prefetched payloads, no server round-trip, no spinner) and
 * PageSpeed/Lighthouse always sees a cached document.
 *
 * Language/theme are resolved client-side by LightLanguageProvider (and the
 * app providers for authenticated routes), so per-user state never blocks
 * the initial paint.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={instrumentSans.variable}
    >
      <head>
        {/*
          The document is prerendered as English LTR because language is a client
          preference, so an Arabic session used to paint the whole page LTR and
          only flip to RTL after hydration. A ~10-line pre-paint read of the
          stored preference sets `lang`/`dir` before the first frame; the
          provider below stays the source of truth, and `suppressHydrationWarning`
          on <html> covers the (build-time "en") vs runtime mismatch.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('flousy_language');if(l!=='en'&&l!=='fr'&&l!=='ar')return;var d=document.documentElement;d.lang=l;d.dir=l==='ar'?'rtl':'ltr';}catch(e){}})();`,
          }}
        />
        <InstallPromptCapture />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased">
        <LightLanguageProvider>
          <LocalizedDocumentTitle />
          {children}
          <InstallBanner />
        </LightLanguageProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
