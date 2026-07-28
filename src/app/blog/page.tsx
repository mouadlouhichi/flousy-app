import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { StaticPageShell } from '@/components/static/page-shell';
import { BLOG_POSTS } from '@/lib/blog';
import { OG_IMAGE, SITE_NAME } from '@/lib/seo';

const description = 'Practical guides from Flousy about budgeting methods, money places, and building reliable spending habits.';

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
    title: 'Budgeting Guides · Flousy',
    description,
    url: '/blog',
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Budgeting Guides · Flousy',
    description,
    images: [OG_IMAGE.url],
  },
};

export default function BlogPage() {
  return (
    <StaticPageShell
      eyebrow="Blog"
      title="Notes on money and habits."
      subtitle="Short, practical writing about budgeting well — from the team building Flousy."
      maxWidth="max-w-4xl"
    >
      <div className="divide-y divide-foreground/10 border-y border-foreground/10">
        {BLOG_POSTS.map((post) => (
          <article key={post.slug} className="group py-10 first:pt-10 lg:py-12">
            <div className="mb-4 flex items-center gap-3 font-mono text-sm text-muted-foreground">
              <time dateTime={post.dateTime}>{post.date}</time>
              <span aria-hidden="true" className="text-foreground/20">
                |
              </span>
              <span>{post.readTime}</span>
            </div>
            <h2 className="mb-3 font-display text-2xl text-foreground lg:text-3xl">
              <Link
                href={`/blog/${post.slug}`}
                className="transition-colors hover:text-primary"
              >
                {post.title}
              </Link>
            </h2>
            <p className="max-w-2xl leading-relaxed text-muted-foreground">{post.excerpt}</p>
            <Link
              href={`/blog/${post.slug}`}
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
              aria-label={`Read ${post.title}`}
            >
              Read article
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </article>
        ))}
      </div>

      <p className="mt-16 text-muted-foreground">
        More on the way. Have a topic you&apos;d like us to cover?{' '}
        <Link
          href="/contact"
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          Let us know
        </Link>
        .
      </p>
    </StaticPageShell>
  );
}
