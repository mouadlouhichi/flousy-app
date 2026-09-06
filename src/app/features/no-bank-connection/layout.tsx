import type { ReactNode } from 'react';
import { staticPageMetadata } from '@/lib/page-meta';
import { SITE_URL } from '@/lib/seo';

export const metadata = staticPageMetadata(
  'features/no-bank-connection',
  'No Bank Connection — Private Budget Tracker by Design | SmartJib',
  'SmartJib never asks for bank login or card numbers. Manual entry, local cache, Firestore Rules isolation, export and deletion controls.',
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Features', item: `${SITE_URL}/features` },
          { '@type': 'ListItem', position: 3, name: 'No Bank Connection', item: `${SITE_URL}/features/no-bank-connection` },
        ],
      })}} />
      {children}
    </>
  );
}
