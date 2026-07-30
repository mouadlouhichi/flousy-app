import type { MetadataRoute } from 'next';
import { BLOG_POSTS } from '@/lib/blog';
import { SITE_URL } from '@/lib/seo';

const lastModified = new Date('2026-07-28T00:00:00.000Z');

const blogPostEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
  url: `${SITE_URL}/blog/${post.slug}`,
  lastModified: new Date(`${post.dateTime}T00:00:00.000Z`),
  changeFrequency: 'yearly',
  priority: 0.7,
}));

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    ...blogPostEntries,
    {
      url: `${SITE_URL}/help`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/cookies`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/careers`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];
}
