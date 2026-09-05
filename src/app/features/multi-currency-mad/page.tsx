"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";
import { useLightLanguage } from "@/lib/i18n-light";

export default function MultiCurrencyMadPage() {
  return (
    <StaticPageShell
      eyebrow="Features · Morocco"
      title="Budget tracker that supports MAD and Moroccan dirham."
      subtitle="12 currencies formatted for your locale. Built for Morocco's cash culture — track bank, home and wallet separately in dirham without bank connections."
    >
      <div className="prose-flousy space-y-10">
        <div>
          <h2 className="font-display text-2xl lg:text-3xl mb-4">Why MAD support matters in Morocco</h2>
          <p className="text-muted-foreground leading-relaxed">
            Most budget apps default to USD or EUR and treat MAD as an afterthought. SmartJib supports <strong className="text-foreground">MAD as a first-class currency</strong> with proper Arabic/French number formatting via <code>Intl.NumberFormat</code>. 
            Change display currency from <Link href="/dashboard/profile/preferences" className="text-foreground underline">Profile → Preferences</Link> — historical months keep their saved currency so your January in MAD doesn&apos;t suddenly become EUR.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Learn more about <Link href="/features/track-bank-home-wallet" className="text-foreground underline underline-offset-4 hover:no-underline">how bank, home and wallet tracking works</Link> and 
            <Link href="/blog/what-its-for-vs-where-it-is" className="text-foreground underline underline-offset-4 hover:no-underline"> why purpose and location must stay separate</Link>.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl lg:text-3xl mb-4">12 currencies supported</h2>
          <ul className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
            {['MAD — Moroccan Dirham', 'EUR — Euro', 'USD — US Dollar', 'GBP — British Pound', 'CAD — Canadian Dollar', 'CHF — Swiss Franc', 'AED — UAE Dirham', 'SAR — Saudi Riyal', 'EGP — Egyptian Pound', 'TND — Tunisian Dinar', 'DZD — Algerian Dinar', 'XOF — CFA Franc'].map(c=>(
              <li key={c} className="border border-foreground/10 px-3 py-2">{c}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-2xl lg:text-3xl mb-4">How to track in MAD</h2>
          <ol className="list-decimal ps-5 space-y-2 text-muted-foreground">
            <li>Set MAD as display currency during onboarding — or later in Profile.</li>
            <li>Add income: salary 12,000 MAD, side income etc. SmartJib splits into needs, wants, savings automatically.</li>
            <li>Log expense: choose category (needs/wants/savings) and payment place (bank/home/wallet). Your wallet balance updates instantly.</li>
            <li>Reconcile weekly: count cash in wallet vs tracked balance — see <Link href="/blog/track-cash-wallet-spending" className="text-foreground underline">wallet leak guide</Link>.</li>
          </ol>
        </div>

        <div className="border border-foreground/10 p-6">
          <h3 className="font-display text-xl mb-3">Related features</h3>
          <ul className="space-y-2 text-sm">
            <li>→ <Link href="/features/track-bank-home-wallet" className="underline underline-offset-4 hover:no-underline">Track bank, home and wallet as separate balances</Link></li>
            <li>→ <Link href="/features/expense-tracking" className="underline underline-offset-4 hover:no-underline">Track wallet spending without mixing bank balance</Link></li>
            <li>→ <Link href="/features/no-bank-connection" className="underline underline-offset-4 hover:no-underline">Private budget tracker with no bank connection</Link></li>
            <li>→ <Link href="/budgeting-methods" className="underline underline-offset-4 hover:no-underline">Compare 4 budgeting methods: 50/30/20, zero-based, envelope, pay-yourself-first</Link></li>
            <li>→ <Link href="/" className="underline underline-offset-4 hover:no-underline">Free private budget tracker for Morocco — homepage</Link></li>
          </ul>
        </div>
      </div>
    </StaticPageShell>
  );
}
