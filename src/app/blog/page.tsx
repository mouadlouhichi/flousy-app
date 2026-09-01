import type { Metadata } from 'next';
import { BlogList } from '@/components/static/blog-list';
import { OG_IMAGE, SITE_NAME } from '@/lib/seo';

const description = 'Practical guides from SmartJib about budgeting methods, money places, and building reliable spending habits.';

export const metadata: Metadata = {
  title: 'Blog',
  description,
  robots: {
    index: true,
    follow: true,
  },
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

export default function BlogPage() {
  return <BlogList />;
}
