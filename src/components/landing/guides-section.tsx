"use client";

import Link from "next/link";
import { useLightLanguage } from "@/lib/i18n-light";
import { ArrowRight } from "lucide-react";
import { getLocalizedBlogPosts } from "@/lib/blog-locales";

export function GuidesSection() {
  const { messages: m, language, intlLocale, t } = useLightLanguage();
  const localizedPosts = getLocalizedBlogPosts(language);
  const guidesConfig = (m.landing as any).guides || {};
  const readTimeLabel = m.static.blog.readingTime as string;

  // Map slugs to localized posts for i18n titles/excerpts
  const guides = [
    {
      slug: "what-its-for-vs-where-it-is",
      href: "/blog/what-its-for-vs-where-it-is",
      fallback: { category: "Budgeting Foundations", anchor: "Learn why purpose and location must stay separate", readTime: 4 },
    },
    {
      slug: "pick-a-budgeting-style",
      href: "/blog/pick-a-budgeting-style",
      fallback: { category: "Budgeting Methods", anchor: "Compare 4 budgeting methods for Moroccan salaries", readTime: 5 },
    },
    {
      slug: "track-cash-wallet-spending",
      href: "/blog/track-cash-wallet-spending",
      fallback: { category: "Cash Tracking", anchor: "Track wallet spending without mixing bank balance", readTime: 3 },
    },
  ].map((g, idx) => {
    const localized = localizedPosts.find(p => p.slug === g.slug);
    const configItem = guidesConfig.items?.[idx];
    return {
      ...g,
      title: localized?.title || configItem?.title || g.fallback.anchor,
      excerpt: localized?.excerpt || configItem?.excerpt || "",
      category: configItem?.category || g.fallback.category,
      anchor: configItem?.anchor || g.fallback.anchor,
      readingMinutes: localized?.readingMinutes || g.fallback.readTime,
    };
  });

  const eyebrow = guidesConfig.eyebrow || "Budgeting Guides";
  const titleLine1 = guidesConfig.titleLine1 || "Learn to budget better,";
  const titleLine2 = guidesConfig.titleLine2 || "with MAD in mind.";
  const description = guidesConfig.description || "Short, practical guides from the SmartJib team.";
  const viewAll = guidesConfig.viewAll || "View all budgeting guides";
  const madCta = guidesConfig.madGuideCta || "Budget tracker MAD guide";
  const methodsCta = guidesConfig.methodsCta || "4 budgeting methods explained";

  return (
    <section id="guides" className="relative py-24 lg:py-32 border-t border-foreground/10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 lg:mb-20 max-w-3xl">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest/80 py-1.5 pe-4 ps-1.5 text-[13px] font-medium text-on-surface shadow-ambient backdrop-blur">
            <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-lime text-forest-deep"><span className="size-1.5 rounded-full bg-forest-deep" /></span>{eyebrow}
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-6">
            {titleLine1}
            <br />
            <span className="text-muted-foreground">{titleLine2}</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {description}{" "}
            <Link href="/features/multi-currency-mad" className="text-foreground underline underline-offset-4 hover:no-underline">MAD and dirham support</Link>,{" "}
            <Link href="/features/track-bank-home-wallet" className="text-foreground underline underline-offset-4 hover:no-underline">bank, home and wallet separation</Link>, and{" "}
            <Link href="/budgeting-methods" className="text-foreground underline underline-offset-4 hover:no-underline">4 budgeting methods including 50/30/20</Link>.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
          {guides.map((guide) => (
            <article key={guide.slug} className="group flex flex-col border border-foreground/10 p-7 lg:p-8 hover:border-foreground/20 transition-colors">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-foreground/5 text-muted-foreground">{guide.category}</span>
                <span className="text-xs font-mono text-muted-foreground">{t(readTimeLabel, { minutes: guide.readingMinutes })}</span>
              </div>
              <h3 className="font-display text-xl lg:text-2xl mb-3 group-hover:text-primary transition-colors">
                <Link href={guide.href}>{guide.title}</Link>
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">{guide.excerpt}</p>
              <Link href={guide.href} className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline">
                {guide.anchor} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/blog" className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-6 py-3 text-sm font-medium hover:bg-foreground/90">
            {viewAll} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/features/multi-currency-mad" className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-6 py-3 text-sm font-medium hover:border-foreground/30">
            {madCta}
          </Link>
          <Link href="/budgeting-methods" className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-6 py-3 text-sm font-medium hover:border-foreground/30">
            {methodsCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
