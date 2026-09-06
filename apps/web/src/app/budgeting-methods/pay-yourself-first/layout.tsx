import type { ReactNode } from 'react';
import { staticPageMetadata } from '@/lib/page-meta';
import { SITE_URL } from '@/lib/seo';

export const metadata = staticPageMetadata(
  'budgeting-methods/pay-yourself-first',
  'Pay Yourself First Explained — Save 30% Before Spending | SmartJib',
  'Pay-yourself-first budgeting: 45% needs, 25% wants, 30% savings. Put savings first before optional spending — works when saving is always postponed.',
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Budgeting Methods', item: `${SITE_URL}/budgeting-methods` },
          { '@type': 'ListItem', position: 3, name: 'Pay Yourself First', item: `${SITE_URL}/budgeting-methods/pay-yourself-first` },
        ],
      })}} />
      {children}
    </>
  );
}
