import type { ReactNode } from 'react';
import { staticPageMetadata } from '@/lib/page-meta';
import { SITE_URL } from '@/lib/seo';

export const metadata = staticPageMetadata(
  'features/track-bank-home-wallet',
  'Track Bank, Home & Wallet Separately — Money Places Explained | SmartJib',
  'Stop mixing budget and balance. SmartJib tracks bank, home and wallet as separate money places, so transfers don\'t look like spending.',
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Features', item: `${SITE_URL}/features` },
          { '@type': 'ListItem', position: 3, name: 'Bank Home Wallet', item: `${SITE_URL}/features/track-bank-home-wallet` },
        ],
      })}} />
      {children}
    </>
  );
}
