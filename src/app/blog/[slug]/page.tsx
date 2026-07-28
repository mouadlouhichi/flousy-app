import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { FooterSection } from '@/components/landing/footer-section';
import { Navigation } from '@/components/landing/navigation';
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

  if (!post) {
    return {};
  }

  const path = `/blog/${post.slug}`;
  const socialTitle = `${post.title} · Flousy`;

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: 'Flousy Team' }],
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
      authors: ['Flousy Team'],
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

  if (!post) {
    notFound();
  }

  const url = `${SITE_URL}/blog/${post.slug}`;
  const relatedPosts = BLOG_POSTS.filter((candidate) => candidate.slug !== post.slug);

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
      name: 'Flousy Team',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/icon.png`,
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

      <main className="noise-overlay relative min-h-screen overflow-x-hidden">
        <Navigation />

        <article>
          <header className="relative pb-16 pt-36 lg:pb-20 lg:pt-44">
            <div className="mx-auto max-w-4xl px-6 lg:px-12">
              <nav
                aria-label="Breadcrumb"
                className="mb-8 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground"
              >
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
                <span aria-hidden="true">/</span>
                <Link href="/blog" className="hover:text-foreground">
                  Blog
                </Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page" className="max-w-full truncate text-foreground">
                  {post.title}
                </span>
              </nav>

              <Link
                href="/blog"
                className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                All articles
              </Link>

              <h1 className="mb-6 font-display text-4xl tracking-tight text-foreground md:text-5xl lg:text-6xl">
                {post.title}
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
                {post.excerpt}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-6 font-mono text-sm text-muted-foreground">
                <span>By Flousy Team</span>
                <span aria-hidden="true" className="text-foreground/20">
                  |
                </span>
                <time dateTime={post.dateTime}>{post.date}</time>
                <span aria-hidden="true" className="text-foreground/20">
                  |
                </span>
                <span>{post.readTime}</span>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-3xl px-6 pb-24 lg:px-12 lg:pb-32">
            {post.sections.map((section) => (
              <section key={section.heading} className="mb-12 last:mb-0">
                <h2 className="mb-5 font-display text-3xl tracking-tight text-foreground">
                  {section.heading}
                </h2>

                <div className="space-y-5">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-lg leading-8 text-muted-foreground">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {section.bullets && (
                  <ul className="mt-6 space-y-3 pl-1">
                    {section.bullets.map((item) => (
                      <li key={item} className="flex gap-3 text-lg leading-8 text-muted-foreground">
                        <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.callout && (
                  <aside className="mt-7 border-l-4 border-primary bg-foreground/[0.03] px-6 py-5 text-lg leading-8 text-foreground">
                    {section.callout}
                  </aside>
                )}
              </section>
            ))}

            <div className="mt-16 border-y border-foreground/10 py-8">
              <p className="mb-5 text-muted-foreground">
                Flousy keeps budget envelopes separate from bank, home, and wallet balances.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary/90"
              >
                Start budgeting free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </article>

        <aside aria-labelledby="related-articles" className="border-t border-foreground/10 py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-12">
            <h2 id="related-articles" className="mb-10 font-display text-3xl text-foreground">
              Continue reading
            </h2>
            <div className="grid gap-8 md:grid-cols-2">
              {relatedPosts.map((relatedPost) => (
                <article key={relatedPost.slug} className="border border-foreground/10 p-7">
                  <div className="mb-3 font-mono text-xs text-muted-foreground">
                    <time dateTime={relatedPost.dateTime}>{relatedPost.date}</time>
                    {' · '}
                    {relatedPost.readTime}
                  </div>
                  <h3 className="mb-3 font-display text-2xl text-foreground">
                    <Link href={`/blog/${relatedPost.slug}`} className="hover:text-primary">
                      {relatedPost.title}
                    </Link>
                  </h3>
                  <p className="mb-5 leading-relaxed text-muted-foreground">
                    {relatedPost.excerpt}
                  </p>
                  <Link
                    href={`/blog/${relatedPost.slug}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
                  >
                    Read article
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <FooterSection />
      </main>
    </>
  );
}
