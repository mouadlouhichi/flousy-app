import type { Metadata } from 'next';
import { DEFAULT_ROBOTS, OG_IMAGE, OG_LOCALE, SITE_URL, TWITTER_CARD } from './seo';

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
 *
 * Every page also gets the shared OG image plus a large-image Twitter card so
 * shared links unfurl with a preview; without explicit `images` here the
 * cards rendered text-only.
 */
export function staticPageMetadata(route: string, title: string, description: string): Metadata {
  const path = route ? `/${route}` : '/';
  return {
    title: { absolute: title },
    description,
    robots: DEFAULT_ROBOTS,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${path}`,
      type: 'website',
      siteName: 'SmartJib',
      locale: OG_LOCALE,
      images: [OG_IMAGE],
    },
    twitter: {
      card: TWITTER_CARD,
      title,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
