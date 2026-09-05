"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";

export default function Page() {
  return (
    <StaticPageShell eyebrow="Budgeting Methods · Zero-Based" title="Zero-based budgeting: give every MAD a job." subtitle="60% needs, 25% wants, 15% savings in SmartJib. Its core habit is assigning all income an explicit job rather than leaving money unplanned.">
      <div className="prose-flousy space-y-10">
        <div>
          <h2 className="font-display text-2xl mb-4">Core habit</h2>
          <p className="text-muted-foreground leading-relaxed">Income minus allocations equals zero. Every dirham has a category. Prevents unassigned money from disappearing into small cash spends — see <Link href="/blog/track-cash-wallet-spending" className="text-foreground underline">wallet leak guide</Link>.</p>
        </div>
        <div className="border border-foreground/10 p-6">
          <h3 className="font-display text-xl mb-3">Related</h3>
          <ul className="space-y-2 text-sm">
            <li>→ <Link href="/budgeting-methods" className="underline">Compare 4 budgeting methods</Link></li>
            <li>→ <Link href="/budgeting-methods/50-30-20-rule" className="underline">50/30/20 rule explained</Link></li>
            <li>→ <Link href="/features/track-bank-home-wallet" className="underline">Track bank, home, wallet separately</Link></li>
            <li>→ <Link href="/" className="underline">Free private budget tracker</Link></li>
          </ul>
        </div>
      </div>
    </StaticPageShell>
  );
}
