"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";

export default function ExpenseTrackingPage() {
  return (
    <StaticPageShell eyebrow="Features" title="Fix the wallet leak — where cash quietly disappears." subtitle="Card spending leaves a trace. Cash doesn't. SmartJib makes wallet spending visible with fast logging and weekly reconciliation.">
      <div className="prose-flousy space-y-10">
        <div>
          <h2 className="font-display text-2xl lg:text-3xl mb-4">Why cash tracking fails</h2>
          <p className="text-muted-foreground leading-relaxed">
            Small purchases feel harmless: transport, snacks, tips. You postpone recording, then forget. Result: budget says money remains, wallet is empty. The missing amount is not one large expense — it&apos;s a series of unrecorded cash spends.
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl lg:text-3xl mb-4">SmartJib habit</h2>
          <ol className="list-decimal ps-5 space-y-2 text-muted-foreground">
            <li>Log purchase before putting wallet away — amount, category, wallet as place.</li>
            <li>Keep unrecorded receipts in one pocket.</li>
            <li>Reconcile weekly: count cash vs tracked wallet balance.</li>
            <li>Give cash a deliberate limit: transfer planned amount to wallet at start of week.</li>
          </ol>
          <p className="mt-4 text-muted-foreground">
            Deep dive: <Link href="/blog/track-cash-wallet-spending" className="text-foreground underline">The wallet leak guide — where small cash spending adds up</Link>.
          </p>
        </div>
        <div className="border border-foreground/10 p-6">
          <h3 className="font-display text-xl mb-3">Related</h3>
          <ul className="space-y-2 text-sm">
            <li>→ <Link href="/features/track-bank-home-wallet" className="underline">Track bank, home and wallet as separate balances</Link></li>
            <li>→ <Link href="/blog/what-its-for-vs-where-it-is" className="underline">Why purpose and location are different questions</Link></li>
            <li>→ <Link href="/features/multi-currency-mad" className="underline">Budget tracker MAD and dirham</Link></li>
            <li>→ <Link href="/budgeting-methods" className="underline">Compare 4 budgeting methods</Link></li>
          </ul>
        </div>
      </div>
    </StaticPageShell>
  );
}
