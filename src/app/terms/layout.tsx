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
  'terms',
  'Terms of Service — SmartJib',
  'The agreement between you and SmartJib: what the app promises, what it does not do, and how subscriptions and termination are handled.',
);

export default function TermsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Terms of Service — SmartJib',
            description: 'The agreement between you and SmartJib: what the app promises, what it does not do, and how subscriptions and termination are handled.',
            url: `${SITE_URL}/terms`,
            isPartOf: { '@type': 'WebSite', name: 'SmartJib', url: SITE_URL },
            inLanguage: ['en', 'fr', 'ar'],
          }),
        }}
      />
      {children}
    </>
  );
}
