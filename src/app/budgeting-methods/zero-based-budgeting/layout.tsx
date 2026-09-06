import type { ReactNode } from 'react';
import { staticPageMetadata } from '@/lib/page-meta';
import { SITE_URL } from '@/lib/seo';

export const metadata = staticPageMetadata(
  'budgeting-methods/zero-based-budgeting',
  'Zero-Based Budgeting Explained — Give Every Dirham a Job | SmartJib',
  'Zero-based budgeting in SmartJib: 60% needs, 25% wants, 15% savings starting point. Give every MAD a job so nothing disappears unassigned.',
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Budgeting Methods', item: `${SITE_URL}/budgeting-methods` },
          { '@type': 'ListItem', position: 3, name: 'Zero-Based Budgeting', item: `${SITE_URL}/budgeting-methods/zero-based-budgeting` },
        ],
      })}} />
      {children}
    </>
  );
}
