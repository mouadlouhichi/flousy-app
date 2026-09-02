'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { FooterSection } from '@/components/landing/footer-section';
import { Navigation } from '@/components/landing/navigation';
import { getLocalizedBlogPost, getLocalizedBlogPosts } from '@/lib/blog-locales';
import { useLightLanguage } from '@/lib/i18n-light';

function formatBlogDate(dateTime: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateTime}T12:00:00Z`));
}

export function BlogArticle({ slug }: { slug: string }) {
  const { language, messages: m, t, intlLocale, isRTL } = useLightLanguage();
  const s = m.static.blog;
  const post = getLocalizedBlogPost(slug, language);
  const relatedPosts = getLocalizedBlogPosts(language).filter((candidate) => candidate.slug !== slug);

  useEffect(() => {
    if (post) document.title = `${post.title} · ${m.common.appName}`;
    // `post` is rebuilt from the catalog on every render, so depending on it (or
    // on the object identity the rule suggests) would re-run this on each paint;
    // the title only needs to follow the values it actually reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.common.appName, post?.title]);

  // The server page already verifies the slug for static generation. This
  // fallback keeps the client render safe if a stale route is ever restored.
  if (!post) return null;

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <main id="main-content" className="noise-overlay relative min-h-screen overflow-x-hidden">
      <Navigation />

      <article>
        <header className="relative pb-16 pt-36 lg:pb-20 lg:pt-44">
          <div className="mx-auto max-w-4xl px-6 lg:px-12">
            <nav
              aria-label={s.breadcrumb}
              className="mb-8 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground"
            >
              <Link href="/" className="hover:text-foreground">
                {s.home}
              </Link>
              <span aria-hidden="true">/</span>
              <Link href="/blog" className="hover:text-foreground">
                {s.eyebrow}
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
              <BackIcon className="h-4 w-4" />
              {s.allArticles}
            </Link>

            <h1 className="mb-6 font-display text-3xl tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
              {post.title}
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
              {post.excerpt}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-6 font-mono text-sm text-muted-foreground">
              <span>{s.byAuthor}</span>
              <span aria-hidden="true" className="text-foreground/20">
                |
              </span>
              <time dateTime={post.dateTime}>{formatBlogDate(post.dateTime, intlLocale)}</time>
              <span aria-hidden="true" className="text-foreground/20">
                |
              </span>
              <span>{t(s.readingTime, { minutes: post.readingMinutes })}</span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-6 pb-24 lg:px-12 lg:pb-32">
          {post.sections.map((section) => (
            <section key={section.heading} className="mb-12 last:mb-0">
              <h2 className="mb-5 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
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
                <ul className="mt-6 space-y-3 ps-1">
                  {section.bullets.map((item) => (
                    <li key={item} className="flex gap-3 text-lg leading-8 text-muted-foreground">
                      <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {section.callout && (
                <aside className="mt-7 border-s-4 border-primary bg-foreground/[0.03] px-6 py-5 text-lg leading-8 text-foreground">
                  {section.callout}
                </aside>
              )}
            </section>
          ))}

          <div className="mt-16 border-y border-foreground/10 py-8">
            <p className="mb-5 text-muted-foreground">{s.articleCtaDescription}</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-accent-foreground"
            >
              {s.startBudgeting}
              <ArrowRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
            </Link>
          </div>
        </div>
      </article>

      <aside aria-labelledby="related-articles" className="border-t border-foreground/10 py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-12">
          <h2 id="related-articles" className="mb-10 font-display text-2xl text-foreground sm:text-3xl">
            {s.continueReading}
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            {relatedPosts.map((relatedPost) => (
              <article key={relatedPost.slug} className="border border-foreground/10 p-7">
                <div className="mb-3 font-mono text-xs text-muted-foreground">
                  <time dateTime={relatedPost.dateTime}>{formatBlogDate(relatedPost.dateTime, intlLocale)}</time>
                  {' · '}
                  {t(s.readingTime, { minutes: relatedPost.readingMinutes })}
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
                  aria-label={t(s.readArticleAria, { title: relatedPost.title })}
                >
                  {s.readArticle}
                  <ArrowRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </aside>

      <FooterSection />
    </main>
  );
}
