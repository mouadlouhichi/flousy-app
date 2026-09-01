import type { ReactNode } from 'react';
import { staticPageMetadata } from '@/lib/page-meta';
import { SITE_URL } from '@/lib/seo';

/**
 * Route-level metadata for a prerendered static page.
 *
 * The page below is a client component (it renders localized copy), and a client
 * module cannot export `metadata` — so until now these indexable URLs inherited
 * the root title and description verbatim, i.e. seven pages shared one `<title>`
 * and had no canonical of their own. A layout is the smallest place where a
 * server component can supply that metadata without rewriting the page, and it
 * also carries the `WebPage` node answer engines use to attribute a quote.
 */
export const metadata = staticPageMetadata(
  'help',
  'Help center — how SmartJib budgeting works',
  'Guides for the 50/30/20, zero-based, envelope and pay-yourself-first strategies, money places, shared household budgets, savings and CSV import.',
);

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Help center — how SmartJib budgeting works',
            description: 'Guides for the 50/30/20, zero-based, envelope and pay-yourself-first strategies, money places, shared household budgets, savings and CSV import.',
            url: `${SITE_URL}/help`,
            isPartOf: { '@type': 'WebSite', name: 'SmartJib', url: SITE_URL },
            inLanguage: ['en', 'fr', 'ar'],
          }),
        }}
      />
      {children}
    </>
  );
}
