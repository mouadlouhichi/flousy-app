"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";

export default function Page() {
  return (
    <StaticPageShell eyebrow="Budgeting Methods · 50/30/20" title="50/30/20 Rule: 50% needs, 30% wants, 20% savings." subtitle="Balanced starting point when essentials fit near half of income. See Moroccan salary examples and how SmartJib calculates it automatically.">
      <div className="prose-flousy space-y-10">
        <div>
          <h2 className="font-display text-2xl mb-4">What is 50/30/20?</h2>
          <p className="text-muted-foreground leading-relaxed">Needs 50%, wants 30%, savings 20%. Popularized by Senator Elizabeth Warren, it&apos;s a simple baseline: cover essentials with half, enjoy life with 30%, save 20%. In SmartJib, pick it during onboarding — needs/wants/savings caps are calculated automatically.</p>
          <p className="text-muted-foreground leading-relaxed mt-4">Example: 12,000 MAD salary → Needs 6,000 MAD, Wants 3,600 MAD, Savings 2,400 MAD. Adjust caps per category: rent, groceries under needs; dining out under wants.</p>
        </div>
        <div>
          <h2 className="font-display text-2xl mb-4">When it fits</h2>
          <p className="text-muted-foreground">Best if essentials are near 50% of take-home. If rent alone is 60% in Casablanca, consider <Link href="/budgeting-methods/envelope-budgeting" className="text-foreground underline">envelope budgeting 55/35/10</Link> or <Link href="/budgeting-methods/zero-based-budgeting" className="text-foreground underline">zero-based</Link>.</p>
        </div>
        <div className="border border-foreground/10 p-6">
          <h3 className="font-display text-xl mb-3">Related</h3>
          <ul className="space-y-2 text-sm">
            <li>→ <Link href="/budgeting-methods" className="underline">Compare 4 budgeting methods</Link></li>
            <li>→ <Link href="/blog/pick-a-budgeting-style" className="underline">Picking a budgeting style that fits you</Link></li>
            <li>→ <Link href="/features/multi-currency-mad" className="underline">Budget tracker MAD and dirham</Link></li>
            <li>→ <Link href="/" className="underline">Free private budget tracker — homepage</Link></li>
          </ul>
        </div>
      </div>
    </StaticPageShell>
  );
}
