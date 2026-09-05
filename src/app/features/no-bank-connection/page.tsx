"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";

export default function NoBankConnectionPage() {
  return (
    <StaticPageShell eyebrow="Features · Privacy" title="Your money, your business. No bank connections." subtitle="We never ask for bank login, card numbers, or account numbers. Manual entry, local cache, Firestore Rules isolation.">
      <div className="prose-flousy space-y-10">
        <div>
          <h2 className="font-display text-2xl lg:text-3xl mb-4">Private by default</h2>
          <p className="text-muted-foreground leading-relaxed">
            Budgeting means sharing personal details. SmartJib treats that seriously: personal workspaces stay private to their owner, Household workspaces are shared only with active members by role, your data is never sold, and you can export or delete it from Profile.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            See <Link href="/about" className="text-foreground underline">why we built SmartJib without bank connections</Link> and <Link href="/privacy" className="text-foreground underline">privacy policy</Link>.
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl lg:text-3xl mb-4">How data is stored</h2>
          <ul className="list-disc ps-5 space-y-2 text-muted-foreground">
            <li>Account data cached locally in IndexedDB for offline use.</li>
            <li>Synced to Firebase when you sign in — Firestore Rules isolate personal workspaces.</li>
            <li>No advertising cookies, no cross-site tracking. Analytics only if you explicitly consent.</li>
            <li>Export CSV or full JSON backup from Profile. Delete account permanently with retry reporting.</li>
          </ul>
        </div>
        <div className="border border-foreground/10 p-6">
          <h3 className="font-display text-xl mb-3">Related</h3>
          <ul className="space-y-2 text-sm">
            <li>→ <Link href="/about" className="underline">About SmartJib — private offline-first budget tracker</Link></li>
            <li>→ <Link href="/features/multi-currency-mad" className="underline">Budget tracker MAD — multi-currency</Link></li>
            <li>→ <Link href="/features/track-bank-home-wallet" className="underline">Track bank, home, wallet separately</Link></li>
            <li>→ <Link href="/" className="underline">Free private budget tracker — homepage</Link></li>
          </ul>
        </div>
      </div>
    </StaticPageShell>
  );
}
