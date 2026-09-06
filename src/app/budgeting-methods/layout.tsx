import type { ReactNode } from 'react';
import { staticPageMetadata } from '@/lib/page-meta';
import { SITE_URL } from '@/lib/seo';

export const metadata = staticPageMetadata(
  'budgeting-methods',
  '4 Budgeting Methods Explained: 50/30/20, Zero-Based, Envelope, Pay-Yourself-First | SmartJib',
  'Compare 4 budgeting methods: 50/30/20, zero-based, envelope, pay-yourself-first. Find which split fits your Moroccan salary and cash culture.',
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Budgeting Methods', item: `${SITE_URL}/budgeting-methods` },
        ],
      })}} />
      {children}
    </>
  );
}
