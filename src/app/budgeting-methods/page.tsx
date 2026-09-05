"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";

const methods = [
  {
    slug: "50-30-20-rule",
    title: "50/30/20 Rule",
    desc: "50% needs, 30% wants, 20% savings. Balanced starting point when essentials fit near half of income.",
    href: "/budgeting-methods/50-30-20-rule",
    anchor: "Learn 50/30/20 budgeting for Moroccan salaries",
    percent: "50/30/20",
  },
  {
    slug: "zero-based-budgeting",
    title: "Zero-Based Budgeting",
    desc: "60% needs, 25% wants, 15% savings in SmartJib. Give every dirham a job — nothing unassigned.",
    href: "/budgeting-methods/zero-based-budgeting",
    anchor: "Zero-based budgeting guide — give every MAD a job",
    percent: "60/25/15",
  },
  {
    slug: "envelope-budgeting",
    title: "Envelope Budgeting",
    desc: "55% needs, 35% wants, 10% savings. Visible category limits and frequent spending checks.",
    href: "/budgeting-methods/envelope-budgeting",
    anchor: "Envelope budgeting — visible limits for cash spending",
    percent: "55/35/10",
  },
  {
    slug: "pay-yourself-first",
    title: "Pay Yourself First",
    desc: "45% needs, 25% wants, 30% savings. Put larger savings before optional spending.",
    href: "/budgeting-methods/pay-yourself-first",
    anchor: "Pay yourself first — save 30% before spending",
    percent: "45/25/30",
  },
];

export default function BudgetingMethodsPage() {
  return (
    <StaticPageShell
      eyebrow="Budgeting Methods"
      title="4 budgeting methods — pick the one that fits how you live."
      subtitle="SmartJib splits income into needs, wants, savings automatically. Choose a starting structure that matches your Moroccan salary, rent, and savings goal."
      maxWidth="max-w-5xl"
    >
      <div className="mb-10 border border-foreground/10 p-6 bg-foreground/[0.02]">
        <p className="text-sm text-muted-foreground leading-relaxed">
          A budgeting method gives each part of your income a default job. It can reduce decisions each month, but it cannot know your rent, family responsibilities, or irregular income. The useful question is not which method is universally best — it&apos;s which starting structure most closely resembles your real obligations. Read our guide <Link href="/blog/pick-a-budgeting-style" className="text-foreground underline">Picking a budgeting style that actually fits you</Link> and <Link href="/features/multi-currency-mad" className="text-foreground underline">track in MAD and dirham</Link>.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {methods.map((m) => (
          <Link key={m.slug} href={m.href} className="group border border-foreground/10 p-7 hover:border-foreground/20 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-foreground/5">{m.percent}</span>
              <span className="text-xs text-muted-foreground">Method</span>
            </div>
            <h2 className="font-display text-2xl mb-3 group-hover:text-primary">{m.title}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">{m.desc}</p>
            <span className="text-sm font-medium underline-offset-4 group-hover:underline">{m.anchor} →</span>
          </Link>
        ))}
      </div>

      <div className="mt-16 border-y border-foreground/10 py-8">
        <h3 className="font-display text-xl mb-4">Related guides</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <Link href="/blog/pick-a-budgeting-style" className="text-foreground underline">Picking a budgeting style that actually fits you</Link></li>
          <li>• <Link href="/features/track-bank-home-wallet" className="text-foreground underline">Track bank, home, wallet as separate balances</Link></li>
          <li>• <Link href="/features/multi-currency-mad" className="text-foreground underline">Budget tracker that supports MAD and dirham</Link></li>
          <li>• <Link href="/" className="text-foreground underline">Free private budget tracker for Morocco — SmartJib homepage</Link></li>
        </ul>
      </div>
    </StaticPageShell>
  );
}
