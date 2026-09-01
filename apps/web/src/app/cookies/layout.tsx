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
  'cookies',
  'Cookie Policy — SmartJib',
  'The full list of cookies and local storage entries SmartJib uses, what each one is for, and how long each lasts.',
);

export default function CookiesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Cookie Policy — SmartJib',
            description: 'The full list of cookies and local storage entries SmartJib uses, what each one is for, and how long each lasts.',
            url: `${SITE_URL}/cookies`,
            isPartOf: { '@type': 'WebSite', name: 'SmartJib', url: SITE_URL },
            inLanguage: ['en', 'fr', 'ar'],
          }),
        }}
      />
      {children}
    </>
  );
}
