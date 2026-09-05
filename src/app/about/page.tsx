"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";
import { useLightLanguage } from "@/lib/i18n-light";

export default function AboutPage() {
  const { messages: m } = useLightLanguage();
  const s = m.static.about;
  return (
    <StaticPageShell eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle}>
      <div className="prose-flousy space-y-10">
        {[{t:s.s1Title,b:s.s1Body},{t:s.s2Title,b:s.s2Body},{t:s.s3Title,b:s.s3Body},{t:s.s4Title,b:s.s4Body}].map(x=>(
          <div key={x.t}><h2 className="font-display text-2xl lg:text-3xl text-foreground mb-4">{x.t}</h2><p className="text-muted-foreground leading-relaxed">{x.b}</p></div>
        ))}
        <div className="border border-foreground/10 p-6 mt-10">
          <h2 className="font-display text-2xl mb-4">Explore SmartJib</h2>
          <p className="text-muted-foreground leading-relaxed mb-4 text-sm">
            SmartJib is a <Link href="/" className="text-foreground underline">free private budget tracker for Morocco</Link> supporting <Link href="/features/multi-currency-mad" className="text-foreground underline">MAD and dirham</Link>. Learn <Link href="/blog/what-its-for-vs-where-it-is" className="text-foreground underline">why purpose and location are separate</Link>, <Link href="/budgeting-methods" className="text-foreground underline">compare 4 budgeting methods</Link>, and see <Link href="/features/no-bank-connection" className="text-foreground underline">why we don&apos;t ask for bank connections</Link>.
          </p>
          <ul className="space-y-2 text-sm">
            <li>→ <Link href="/features/track-bank-home-wallet" className="underline">Track bank, home, wallet separately</Link></li>
            <li>→ <Link href="/features/expense-tracking" className="underline">Fix wallet leak — cash spending</Link></li>
            <li>→ <Link href="/blog" className="underline">Budgeting guides & money tips</Link></li>
            <li>→ <Link href="/help" className="underline">Help center</Link></li>
          </ul>
        </div>
      </div>
    </StaticPageShell>
  );
}
