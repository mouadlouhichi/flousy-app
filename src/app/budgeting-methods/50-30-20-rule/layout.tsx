import type { ReactNode } from 'react';
import { staticPageMetadata } from '@/lib/page-meta';
import { SITE_URL } from '@/lib/seo';

export const metadata = staticPageMetadata(
  'budgeting-methods/50-30-20-rule',
  '50/30/20 Rule Explained for Morocco — Budget 50% Needs, 30% Wants, 20% Savings | SmartJib',
  'Learn 50/30/20 budgeting for Moroccan salaries: 50% needs, 30% wants, 20% savings. See examples with 12,000 MAD income and how SmartJib calculates it automatically.',
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Budgeting Methods', item: `${SITE_URL}/budgeting-methods` },
          { '@type': 'ListItem', position: 3, name: '50/30/20 Rule', item: `${SITE_URL}/budgeting-methods/50-30-20-rule` },
        ],
      })}} />
      {children}
    </>
  );
}
