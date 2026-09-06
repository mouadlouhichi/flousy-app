'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { StaticPageShell } from '@/components/static/page-shell';
import { getLocalizedBlogPosts } from '@/lib/blog-locales';
import { useLightLanguage } from '@/lib/i18n-light';

function formatBlogDate(dateTime: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateTime}T12:00:00Z`));
}

export function BlogList() {
  const { language, messages: m, t, intlLocale, isRTL } = useLightLanguage();
  const s = m.static.blog;
  const posts = getLocalizedBlogPosts(language);

  useEffect(() => {
    document.title = `${s.eyebrow} · ${m.common.appName}`;
  }, [m.common.appName, s.eyebrow]);

  return (
    <StaticPageShell
      eyebrow={s.eyebrow}
      title={s.title}
      subtitle={s.subtitle}
      maxWidth="max-w-4xl"
    >
      <div className="divide-y divide-foreground/10 border-y border-foreground/10">
        {posts.map((post) => (
          <article key={post.slug} className="group py-10 first:pt-10 lg:py-12">
            <div className="mb-4 flex items-center gap-3 font-mono text-sm text-muted-foreground">
              <time dateTime={post.dateTime}>{formatBlogDate(post.dateTime, intlLocale)}</time>
              <span aria-hidden="true" className="text-foreground/20">
                |
              </span>
              <span>{t(s.readingTime, { minutes: post.readingMinutes })}</span>
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
              aria-label={t(s.readArticleAria, { title: post.title })}
            >
              <span>{s.readArticle}: {post.title}</span>
              <ArrowRight
                className={`h-4 w-4 transition-transform ${
                  isRTL ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'
                }`}
              />
            </Link>
            {/* Semantic internal link to money page for PageRank flow */}
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/" className="text-xs font-mono text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                Free private budget tracker — SmartJib
              </Link>
              <span className="text-xs text-foreground/20">•</span>
              <Link href="/features/multi-currency-mad" className="text-xs font-mono text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                Budget tracker that supports MAD and dirham
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* Internal linking hub for topical authority */}
      <div className="mt-16 border border-foreground/10 p-6 lg:p-8">
        <h3 className="font-display text-xl mb-3">Explore SmartJib features</h3>
        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
          SmartJib is a <Link href="/" className="text-foreground underline underline-offset-4 hover:no-underline">private budget tracker for Morocco</Link> that separates what money is for from where it sits.
          Learn more about <Link href="/features/multi-currency-mad" className="text-foreground underline underline-offset-4 hover:no-underline">multi-currency support including MAD and dirham</Link>, 
          <Link href="/budgeting-methods" className="text-foreground underline underline-offset-4 hover:no-underline"> 4 budgeting methods: 50/30/20, zero-based, envelope and pay-yourself-first</Link>, and 
          <Link href="/about" className="text-foreground underline underline-offset-4 hover:no-underline"> why we built SmartJib without bank connections</Link>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/features/track-bank-home-wallet" className="text-xs px-3 py-1.5 rounded-full border border-foreground/10 hover:border-foreground/30 transition-colors">Bank, home, wallet tracking</Link>
          <Link href="/features/expense-tracking" className="text-xs px-3 py-1.5 rounded-full border border-foreground/10 hover:border-foreground/30 transition-colors">Expense tracking</Link>
          <Link href="/features/no-bank-connection" className="text-xs px-3 py-1.5 rounded-full border border-foreground/10 hover:border-foreground/30 transition-colors">No bank connection privacy</Link>
        </div>
      </div>

      <p className="mt-16 text-muted-foreground">
        {s.moreOnWayPrefix}{' '}
        <Link
          href="/contact"
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          {s.letUsKnow}
        </Link>
        .
      </p>
    </StaticPageShell>
  );
}
