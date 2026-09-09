import type { Metadata } from 'next';
import { BlogList } from '@/components/static/blog-list';
import { JsonLd } from '@/components/seo/json-ld';
import { BLOG_POSTS } from '@/lib/blog';
import { DEFAULT_ROBOTS, OG_IMAGE, SITE_NAME, SITE_URL } from '@/lib/seo';

const description = 'Practical guides from SmartJib about budgeting methods, money places, and building reliable spending habits.';

export const metadata: Metadata = {
  // Rendered as "Budgeting Guides · SmartJib" via the root title template,
  // matching the Open Graph / Twitter titles below. (It used to be "Blog",
  // so the <title> and the social titles disagreed.)
  title: 'Budgeting Guides',
  description,
  robots: DEFAULT_ROBOTS,
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'Budgeting Guides · SmartJib',
    description,
    url: '/blog',
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Budgeting Guides · SmartJib',
    description,
    images: [OG_IMAGE.url],
  },
};

const blogSchema = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'SmartJib Budgeting Guides',
  description,
  url: `${SITE_URL}/blog`,
  inLanguage: 'en',
  publisher: {
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/web-app-manifest-512x512.png`,
    },
  },
  blogPost: BLOG_POSTS.map((post) => ({
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    url: `${SITE_URL}/blog/${post.slug}`,
    datePublished: post.dateTime,
    author: {
      '@type': 'Organization',
      name: 'SmartJib Team',
      url: SITE_URL,
    },
  })),
};

export default function BlogPage() {
  return (
    <>
      <JsonLd id="blog-json-ld" data={blogSchema} />
      <BlogList />
    </>
  );
}
