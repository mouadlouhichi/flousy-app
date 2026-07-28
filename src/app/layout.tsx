import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { InstallBanner } from '@/components/pwa/install-banner';
import { InstallPromptCapture } from '@/components/pwa/install-prompt-capture';
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar';
import { SITE_URL } from '@/lib/seo';
import '../index.css';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
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
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
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
        {children}
        <InstallBanner />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
