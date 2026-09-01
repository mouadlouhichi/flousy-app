import type { Metadata } from 'next';
import { SITE_URL } from './seo';

/**
 * Route-level metadata for the prerendered static pages.
 *
 * Those pages are client components (`'use client'` + the localized message
 * hooks), and a client module cannot export `metadata` — which is why they used
 * to inherit the root title and description verbatim. Seven indexable URLs
 * therefore shared one `<title>`, one description and no canonical, which reads
 * as duplicated content to a crawler and gives answer engines nothing page-
 * specific to quote. Each page now has a small server `layout.tsx` that supplies
 * this metadata while the client page keeps rendering the localized copy.
 */
export function staticPageMetadata(route: string, title: string, description: string): Metadata {
  const path = route ? `/${route}` : '/';
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${path}`,
      type: 'website',
      siteName: 'SmartJib',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}
