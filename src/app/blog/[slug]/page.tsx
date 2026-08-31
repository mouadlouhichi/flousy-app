import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogArticle } from '@/components/static/blog-article';
import { JsonLd } from '@/components/seo/json-ld';
import { BLOG_POSTS, getBlogPost, type BlogPost } from '@/lib/blog';
import { OG_IMAGE, SITE_NAME, SITE_URL } from '@/lib/seo';

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) return {};

  const path = `/blog/${post.slug}`;
  const socialTitle = `${post.title} · SmartJib`;

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: 'SmartJib Team' }],
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: socialTitle,
      description: post.excerpt,
      url: path,
      siteName: SITE_NAME,
      type: 'article',
      locale: 'en_US',
      publishedTime: post.dateTime,
      modifiedTime: post.dateTime,
      authors: ['SmartJib Team'],
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: post.excerpt,
      images: [OG_IMAGE.url],
    },
  };
}

function getWordCount(post: BlogPost): number {
  return post.sections.reduce((total, section) => {
    const sectionText = [
      section.heading,
      ...section.paragraphs,
      ...(section.bullets ?? []),
      section.callout ?? '',
    ].join(' ');

    return total + sectionText.trim().split(/\s+/).filter(Boolean).length;
  }, 0);
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;

  // Keep canonical structured data in the original editorial language. The
  // interactive article component selects complete French/Arabic editions for
  // visitors without changing stable URLs or search indexing.
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.dateTime,
    dateModified: post.dateTime,
    wordCount: getWordCount(post),
    articleSection: 'Personal Finance',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    author: {
      '@type': 'Organization',
      name: 'SmartJib Team',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/web-app-manifest-512x512.png`,
      },
    },
    image: `${SITE_URL}${OG_IMAGE.url}`,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${SITE_URL}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: url,
      },
    ],
  };

  return (
    <>
      <JsonLd id="blog-posting-json-ld" data={articleSchema} />
      <JsonLd id="blog-breadcrumb-json-ld" data={breadcrumbSchema} />
      <BlogArticle slug={post.slug} />
    </>
  );
}
