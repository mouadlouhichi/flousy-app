import type { ReactNode } from 'react';
import { staticPageMetadata } from '@/lib/page-meta';
import { SITE_URL } from '@/lib/seo';

export const metadata = staticPageMetadata(
  'features',
  'SmartJib Features — Private Budget Tracker for Morocco | MAD, Bank, Wallet',
  'Explore SmartJib features: track bank, home and wallet separately, support for MAD and 12 currencies, no bank connection, 4 budgeting methods and private offline-first budgeting.',
);

export default function FeaturesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: 'Features', item: `${SITE_URL}/features` },
            ],
          }),
        }}
      />
      {children}
    </>
  );
}
