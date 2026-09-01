import type { MetadataRoute } from 'next';
import { BLOG_POSTS } from '@/lib/blog';
import { SITE_URL } from '@/lib/seo';

const blogPostEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
  url: `${SITE_URL}/blog/${post.slug}`,
  // Blog posts carry a real publication date, so they keep lastModified.
  lastModified: new Date(`${post.dateTime}T00:00:00.000Z`),
  changeFrequency: 'yearly',
  priority: 0.7,
}));

/**
 * Marketing and legal pages intentionally omit `lastModified`: nothing in the
 * repo records when their copy changed, and a constant date baked into the
 * source would tell crawlers something false forever (the previous value was
 * hard-coded to 2026-07-28). Omitting the field is valid per the sitemap
 * protocol and keeps the feed trustworthy.
 */
type ChangeFrequency = MetadataRoute.Sitemap[number]['changeFrequency'];

function marketingEntry(path: string, priority: number, changeFrequency: ChangeFrequency): MetadataRoute.Sitemap[number] {
  return { url: `${SITE_URL}${path}`, priority, changeFrequency };
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    marketingEntry('', 1, 'monthly'),
    marketingEntry('/about', 0.6, 'yearly'),
    {
      url: `${SITE_URL}/blog`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    ...blogPostEntries,
    marketingEntry('/help', 0.6, 'monthly'),
    marketingEntry('/contact', 0.5, 'yearly'),
    marketingEntry('/privacy', 0.5, 'yearly'),
    marketingEntry('/terms', 0.5, 'yearly'),
    marketingEntry('/cookies', 0.4, 'yearly'),
    marketingEntry('/careers', 0.4, 'monthly'),
  ];
}
