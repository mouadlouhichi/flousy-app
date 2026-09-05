"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";

export default function TrackBankHomeWalletPage() {
  return (
    <StaticPageShell eyebrow="Features" title="Bank, home, wallet — three balances, one truth." subtitle="A budget tells you what money is for. A balance tells you where it sits. SmartJib keeps both views separate so transfers don't look like spending.">
      <div className="prose-flousy space-y-10">
        <div>
          <h2 className="font-display text-2xl lg:text-3xl mb-4">The core idea</h2>
          <p className="text-muted-foreground leading-relaxed">
            Your budget assigns income to needs, wants, savings. Your money places tell you where cash physically sits: bank, home, wallet. Mixing them causes the classic bug: you withdraw 300 MAD, bank goes down 300, wallet up 300 — but if you log it as expense, your total money looks 300 MAD poorer. It isn&apos;t.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Read our guide <Link href="/blog/what-its-for-vs-where-it-is" className="text-foreground underline">Why &apos;what it&apos;s for&apos; and &apos;where it is&apos; are two different questions</Link> for the full mental model.
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl lg:text-3xl mb-4">How it works in SmartJib</h2>
          <ul className="space-y-3 text-muted-foreground list-disc ps-5">
            <li><strong className="text-foreground">Transfer:</strong> bank → wallet. Total unchanged. Both places update together.</li>
            <li><strong className="text-foreground">Expense:</strong> choose category (what it&apos;s for) + place (where it&apos;s paid from). Category progress up, place balance down.</li>
            <li><strong className="text-foreground">Deletion:</strong> reverses balance effect. No ghost money.</li>
          </ul>
        </div>
        <div className="border border-foreground/10 p-6">
          <h3 className="font-display text-xl mb-3">Related</h3>
          <ul className="space-y-2 text-sm">
            <li>→ <Link href="/blog/what-its-for-vs-where-it-is" className="underline">Learn why purpose and location must stay separate</Link></li>
            <li>→ <Link href="/features/expense-tracking" className="underline">Track wallet spending without mixing bank balance</Link></li>
            <li>→ <Link href="/features/multi-currency-mad" className="underline">Budget tracker that supports MAD and dirham</Link></li>
            <li>→ <Link href="/" className="underline">Free private budget tracker — homepage</Link></li>
          </ul>
        </div>
      </div>
    </StaticPageShell>
  );
}
