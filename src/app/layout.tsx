import type { Metadata } from 'next';
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { AuthProvider } from '../lib/auth-context';
import { CurrencyProvider } from '../lib/currency-context';
import { LanguageProvider } from '../lib/i18n-context';
import '../index.css';

const instrumentSans = Instrument_Sans({ 
  subsets: ["latin"],
  variable: '--font-instrument'
});

const instrumentSerif = Instrument_Serif({ 
  subsets: ["latin"],
  weight: "400",
  variable: '--font-instrument-serif'
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-jetbrains'
});

export const metadata: Metadata = {
  title: 'Flousy — Know what your money is for, and where it is',
  description:
    'Flousy is the simple budgeting app that splits your income into needs, wants and savings, and tracks every dirham across your bank, home and wallet. Free to start, with Pro features to help you save even more.',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#00685f',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <AuthProvider>
          <LanguageProvider>
            <CurrencyProvider>{children}</CurrencyProvider>
          </LanguageProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
