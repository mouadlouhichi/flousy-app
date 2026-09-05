import type { MetadataRoute } from 'next';
import { BLOG_POSTS } from '@/lib/blog';
import { SITE_URL } from '@/lib/seo';

const blogPostEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
  url: `${SITE_URL}/blog/${post.slug}`,
  lastModified: new Date(`${post.dateTime}T00:00:00.000Z`),
  changeFrequency: 'monthly' as const,
  priority: 0.6,
}));

type ChangeFrequency = MetadataRoute.Sitemap[number]['changeFrequency'];

function marketingEntry(path: string, priority: number, changeFrequency: ChangeFrequency): MetadataRoute.Sitemap[number] {
  return { url: `${SITE_URL}${path}`, priority, changeFrequency };
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    marketingEntry('', 1, 'monthly'),
    // New topical silos - higher priority for money pages
    marketingEntry('/features', 0.8, 'monthly'),
    marketingEntry('/features/multi-currency-mad', 0.85, 'monthly'),
    marketingEntry('/features/track-bank-home-wallet', 0.8, 'monthly'),
    marketingEntry('/features/expense-tracking', 0.75, 'monthly'),
    marketingEntry('/features/no-bank-connection', 0.75, 'monthly'),
    marketingEntry('/budgeting-methods', 0.85, 'monthly'),
    marketingEntry('/budgeting-methods/50-30-20-rule', 0.75, 'monthly'),
    marketingEntry('/budgeting-methods/zero-based-budgeting', 0.7, 'monthly'),
    marketingEntry('/budgeting-methods/envelope-budgeting', 0.7, 'monthly'),
    marketingEntry('/budgeting-methods/pay-yourself-first', 0.7, 'monthly'),
    // Blog hub - higher frequency
    {
      url: `${SITE_URL}/blog`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...blogPostEntries,
    marketingEntry('/about', 0.6, 'yearly'),
    marketingEntry('/help', 0.6, 'monthly'),
    marketingEntry('/contact', 0.5, 'yearly'),
    marketingEntry('/privacy', 0.3, 'yearly'),
    marketingEntry('/terms', 0.3, 'yearly'),
    marketingEntry('/cookies', 0.2, 'yearly'),
    marketingEntry('/careers', 0.3, 'monthly'),
  ];
}
