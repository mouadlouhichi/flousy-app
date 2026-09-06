import type { ReactNode } from 'react';
import { staticPageMetadata } from '@/lib/page-meta';
import { SITE_URL } from '@/lib/seo';

export const metadata = staticPageMetadata(
  'budgeting-methods/envelope-budgeting',
  'Envelope Budgeting Explained — Visible Limits for Cash Spending | SmartJib',
  'Envelope budgeting: 55% needs, 35% wants, 10% savings starting point. Perfect for Morocco cash culture with visible category limits.',
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Budgeting Methods', item: `${SITE_URL}/budgeting-methods` },
          { '@type': 'ListItem', position: 3, name: 'Envelope Budgeting', item: `${SITE_URL}/budgeting-methods/envelope-budgeting` },
        ],
      })}} />
      {children}
    </>
  );
}
