"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";
import { useLightLanguage } from "@/lib/i18n-light";

export default function FeaturesPage() {
  const { messages: m } = useLightLanguage();
  return (
    <StaticPageShell
      eyebrow="Features"
      title="Everything you need to budget privately."
      subtitle="SmartJib separates what money is for from where it sits — with MAD support, no bank connections, and 4 budgeting methods built for Morocco's cash culture."
      maxWidth="max-w-5xl"
    >
      <div className="grid md:grid-cols-2 gap-6">
        {[
          {
            title: "Multi-currency: MAD & Dirham",
            desc: "Track in MAD, dirham, EUR, USD and 9 more. Change display currency from Profile → Preferences. Historical months keep their saved currency.",
            href: "/features/multi-currency-mad",
            anchor: "Budget tracker that supports MAD and dirham",
          },
          {
            title: "Bank, Home, Wallet Tracking",
            desc: "Your bank balance is not your budget. Track where money sits separately from what it's for. Transfers update both places together.",
            href: "/features/track-bank-home-wallet",
            anchor: "Track bank, home and wallet as separate balances",
          },
          {
            title: "Expense Tracking & Wallet Leak",
            desc: "Cash becomes invisible fast. Log purchases in seconds, choose payment place, and reconcile wallet weekly to close the gap.",
            href: "/features/expense-tracking",
            anchor: "Track wallet spending without mixing bank balance",
          },
          {
            title: "No Bank Connection — Private by Design",
            desc: "We never ask for bank login or card numbers. Manual entry, local cache, Firestore Rules isolation, export and deletion controls.",
            href: "/features/no-bank-connection",
            anchor: "Private budget tracker with no bank connection",
          },
        ].map((f) => (
          <Link key={f.href} href={f.href} className="group border border-foreground/10 p-7 hover:border-foreground/20 transition-colors">
            <h2 className="font-display text-2xl mb-3 group-hover:text-primary">{f.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4 text-sm">{f.desc}</p>
            <span className="text-sm font-medium underline-offset-4 group-hover:underline">{f.anchor} →</span>
          </Link>
        ))}
      </div>

      <div className="mt-16 border-y border-foreground/10 py-8">
        <h3 className="font-display text-xl mb-4">Learn more</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <Link href="/budgeting-methods" className="text-foreground underline underline-offset-4 hover:no-underline">Compare 4 budgeting methods: 50/30/20, zero-based, envelope, pay-yourself-first</Link></li>
          <li>• <Link href="/blog/what-its-for-vs-where-it-is" className="text-foreground underline underline-offset-4 hover:no-underline">Why purpose and location are different questions</Link></li>
          <li>• <Link href="/blog/track-cash-wallet-spending" className="text-foreground underline underline-offset-4 hover:no-underline">The wallet leak: where cash spending adds up</Link></li>
          <li>• <Link href="/" className="text-foreground underline underline-offset-4 hover:no-underline">Free private budget tracker for Morocco — SmartJib homepage</Link></li>
        </ul>
      </div>
    </StaticPageShell>
  );
}
