import type { ReactNode } from 'react';
import { staticPageMetadata } from '@/lib/page-meta';
import { SITE_URL } from '@/lib/seo';

export const metadata = staticPageMetadata(
  'features/expense-tracking',
  'Expense Tracking & Wallet Leak Fix — Track Cash Spending | SmartJib',
  'Cash becomes invisible fast. SmartJib helps you track wallet spending, reconcile weekly, and stop mixing transfers with expenses.',
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Features', item: `${SITE_URL}/features` },
          { '@type': 'ListItem', position: 3, name: 'Expense Tracking', item: `${SITE_URL}/features/expense-tracking` },
        ],
      })}} />
      {children}
    </>
  );
}
