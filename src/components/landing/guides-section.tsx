"use client";

import Link from "next/link";
import { useLightLanguage } from "@/lib/i18n-light";
import { ArrowRight } from "lucide-react";

export function GuidesSection() {
  const { messages: m } = useLightLanguage();

  const guides = [
    {
      slug: "what-its-for-vs-where-it-is",
      title: "Why 'what it's for' and 'where it is' are two different questions",
      excerpt: "Most budgeting frustration comes from mixing up two things that should stay separate: what your money is meant to cover, and where it physically sits.",
      category: "Budgeting Foundations",
      href: "/blog/what-its-for-vs-where-it-is",
      anchor: "Learn why purpose and location must stay separate",
      readTime: "4 min",
    },
    {
      slug: "pick-a-budgeting-style",
      title: "Picking a budgeting style that actually fits you",
      excerpt: "50/30/20 isn't for everyone. How to think about which split of needs, wants, and savings matches how you actually live in Morocco.",
      category: "Budgeting Methods",
      href: "/blog/pick-a-budgeting-style",
      anchor: "Compare 4 budgeting methods for Moroccan salaries",
      readTime: "5 min",
    },
    {
      slug: "track-cash-wallet-spending",
      title: "The wallet leak: where small cash spending quietly adds up",
      excerpt: "Card spending is easy to track. Cash is where budgets usually spring a leak. Habits that make wallet spending visible again.",
      category: "Cash Tracking",
      href: "/blog/track-cash-wallet-spending",
      anchor: "Track wallet spending without mixing bank balance",
      readTime: "3 min",
    },
  ];

  return (
    <section id="guides" className="relative py-24 lg:py-32 border-t border-foreground/10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 lg:mb-20 max-w-3xl">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />Budgeting Guides
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-6">
            Learn to budget better,
            <br />
            <span className="text-muted-foreground">with MAD in mind.</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Short, practical guides from the SmartJib team. Built for Morocco&apos;s cash culture —{' '}
            <Link href="/features/multi-currency-mad" className="text-foreground underline underline-offset-4 hover:no-underline">MAD and dirham support</Link>,{' '}
            <Link href="/features/track-bank-home-wallet" className="text-foreground underline underline-offset-4 hover:no-underline">bank, home and wallet separation</Link>, and{' '}
            <Link href="/budgeting-methods" className="text-foreground underline underline-offset-4 hover:no-underline">4 budgeting methods including 50/30/20</Link>.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
          {guides.map((guide) => (
            <article key={guide.slug} className="group flex flex-col border border-foreground/10 p-7 lg:p-8 hover:border-foreground/20 transition-colors">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-foreground/5 text-muted-foreground">{guide.category}</span>
                <span className="text-xs font-mono text-muted-foreground">{guide.readTime}</span>
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
            View all budgeting guides <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/features/multi-currency-mad" className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-6 py-3 text-sm font-medium hover:border-foreground/30">
            Budget tracker MAD guide
          </Link>
          <Link href="/budgeting-methods" className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-6 py-3 text-sm font-medium hover:border-foreground/30">
            4 budgeting methods explained
          </Link>
        </div>
      </div>
    </section>
  );
}
