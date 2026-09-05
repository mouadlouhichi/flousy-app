"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";

export default function Page() {
  return (
    <StaticPageShell eyebrow="Budgeting Methods · Pay Yourself First" title="Pay yourself first: 30% savings before wants." subtitle="45% needs, 25% wants, 30% savings in SmartJib. Put larger savings allocation in place before optional spending.">
      <div className="prose-flousy space-y-10">
        <div>
          <h2 className="font-display text-2xl mb-4">Core habit</h2>
          <p className="text-muted-foreground leading-relaxed">Save first, spend second. Works best when higher savings share still leaves enough for essentials. If 30% savings leaves needs underfunded, switch to <Link href="/budgeting-methods/50-30-20-rule" className="text-foreground underline">50/30/20</Link> or <Link href="/budgeting-methods/envelope-budgeting" className="text-foreground underline">envelope</Link>.</p>
        </div>
        <div className="border border-foreground/10 p-6">
          <h3 className="font-display text-xl mb-3">Related</h3>
          <ul className="space-y-2 text-sm">
            <li>→ <Link href="/budgeting-methods" className="underline">Compare 4 budgeting methods</Link></li>
            <li>→ <Link href="/features/multi-currency-mad" className="underline">Budget tracker MAD</Link></li>
            <li>→ <Link href="/blog/pick-a-budgeting-style" className="underline">Picking a budgeting style that fits you</Link></li>
            <li>→ <Link href="/" className="underline">Free private budget tracker</Link></li>
          </ul>
        </div>
      </div>
    </StaticPageShell>
  );
}
