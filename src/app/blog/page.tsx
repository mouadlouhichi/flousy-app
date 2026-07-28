import type { Metadata } from "next";
import { StaticPageShell } from "@/components/static/page-shell";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes on budgeting, money habits, and building Flousy.",
};

const posts = [
  {
    title: "Why 'what it's for' and 'where it is' are two different questions",
    excerpt:
      "Most budgeting frustration comes from mixing up two things that should stay separate: what your money is meant to cover, and where it physically sits right now.",
    date: "July 2026",
    readTime: "4 min read",
  },
  {
    title: "Picking a budgeting style that actually fits you",
    excerpt:
      "50/30/20 isn't for everyone. Here's how to think about which split of needs, wants, and savings matches how you actually live.",
    date: "June 2026",
    readTime: "5 min read",
  },
  {
    title: "The wallet leak: where small cash spending quietly adds up",
    excerpt:
      "Card spending is easy to track. Cash is where budgets usually spring a leak. A few habits that make wallet spending visible again.",
    date: "May 2026",
    readTime: "3 min read",
  },
];

export default function BlogPage() {
  return (
    <StaticPageShell
      eyebrow="Blog"
      title="Notes on money and habits."
      subtitle="Short, practical writing about budgeting well — from the team building Flousy."
      maxWidth="max-w-4xl"
    >
      <div className="divide-y divide-foreground/10">
        {posts.map((post) => (
          <article key={post.title} className="py-10 first:pt-0">
            <div className="flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
              <span>{post.date}</span>
              <span className="text-foreground/20">|</span>
              <span>{post.readTime}</span>
            </div>
            <h2 className="font-display text-2xl lg:text-3xl text-foreground mb-3">
              {post.title}
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl">{post.excerpt}</p>
          </article>
        ))}
      </div>

      <p className="mt-16 text-muted-foreground">
        More on the way. Have a topic you'd like us to cover?{" "}
        <a href="/contact" className="text-foreground underline underline-offset-4 hover:no-underline">
          Let us know
        </a>
        .
      </p>
    </StaticPageShell>
  );
}
