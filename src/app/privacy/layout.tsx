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
  'privacy',
  'Privacy Policy — SmartJib',
  'What SmartJib stores about your budget, where it is stored, how long it is kept and how to delete all of it permanently.',
);

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Privacy Policy — SmartJib',
            description: 'What SmartJib stores about your budget, where it is stored, how long it is kept and how to delete all of it permanently.',
            url: `${SITE_URL}/privacy`,
            isPartOf: { '@type': 'WebSite', name: 'SmartJib', url: SITE_URL },
            inLanguage: ['en', 'fr', 'ar'],
          }),
        }}
      />
      {children}
    </>
  );
}
