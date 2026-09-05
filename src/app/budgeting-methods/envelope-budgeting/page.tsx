"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";

export default function Page() {
  return (
    <StaticPageShell eyebrow="Budgeting Methods · Envelope" title="Envelope budgeting: visible limits, frequent checks." subtitle="55% needs, 35% wants, 10% savings in SmartJib. Suits people who want category caps and frequent spending checks — ideal for cash-heavy Morocco.">
      <div className="prose-flousy space-y-10">
        <div>
          <h2 className="font-display text-2xl mb-4">Why envelopes work for cash</h2>
          <p className="text-muted-foreground leading-relaxed">Each category is an envelope with a cap. When envelope is empty, stop or move money deliberately. In SmartJib, envelopes are needs/wants/savings categories with rollover controls in Pro.</p>
          <p className="text-muted-foreground mt-4">Pair with <Link href="/features/expense-tracking" className="text-foreground underline">wallet tracking habit</Link> — transfer weekly amount to wallet as practical limit.</p>
        </div>
        <div className="border border-foreground/10 p-6">
          <h3 className="font-display text-xl mb-3">Related</h3>
          <ul className="space-y-2 text-sm">
            <li>→ <Link href="/budgeting-methods" className="underline">Compare 4 budgeting methods</Link></li>
            <li>→ <Link href="/blog/track-cash-wallet-spending" className="underline">Wallet leak: cash spending adds up</Link></li>
            <li>→ <Link href="/features/multi-currency-mad" className="underline">Budget tracker MAD</Link></li>
            <li>→ <Link href="/" className="underline">Free private budget tracker</Link></li>
          </ul>
        </div>
      </div>
    </StaticPageShell>
  );
}
