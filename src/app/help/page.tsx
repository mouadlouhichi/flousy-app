"use client";
import Link from "next/link";
import { StaticPageShell } from "@/components/static/page-shell";
import { useLightLanguage } from "@/lib/i18n-light";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function HelpPage() {
  const { messages: m } = useLightLanguage();
  const s = m.static.help;
  const faqs = s.faqs as Array<{question:string;answer:string}>;
  const extraLinks: Record<string, { href: string; anchor: string }> = {
    "What's the difference between 'what it's for' and 'where it is'?": { href: "/blog/what-its-for-vs-where-it-is", anchor: "Learn why purpose and location must stay separate" },
    "Do I need to connect my bank account?": { href: "/features/no-bank-connection", anchor: "Private budget tracker with no bank connection" },
    "How does SmartJib decide my budget?": { href: "/budgeting-methods", anchor: "Compare 4 budgeting methods: 50/30/20, zero-based, envelope, pay-yourself-first" },
    "Can I use more than one currency?": { href: "/features/multi-currency-mad", anchor: "Budget tracker that supports MAD and dirham" },
  };
  return (
    <StaticPageShell eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle}>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq,i)=>{
          const extra = extraLinks[faq.question];
          return (
            <AccordionItem key={faq.question} value={`item-${i}`} className="border-foreground/10">
              <AccordionTrigger className="text-lg font-display hover:no-underline py-6">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed text-base">
                <p>{faq.answer}</p>
                {extra && (
                  <p className="mt-3"><Link href={extra.href} className="text-foreground underline underline-offset-4 hover:no-underline text-sm">{extra.anchor} →</Link></p>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <div className="mt-12 border border-foreground/10 p-6">
        <h3 className="font-display text-lg mb-3">Related guides</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <Link href="/blog/what-its-for-vs-where-it-is" className="text-foreground underline">Why purpose and location are different questions</Link></li>
          <li>• <Link href="/blog/track-cash-wallet-spending" className="text-foreground underline">The wallet leak: cash spending adds up</Link></li>
          <li>• <Link href="/blog/pick-a-budgeting-style" className="text-foreground underline">Picking a budgeting style that fits you</Link></li>
          <li>• <Link href="/features/track-bank-home-wallet" className="text-foreground underline">Track bank, home, wallet as separate balances</Link></li>
          <li>• <Link href="/features/multi-currency-mad" className="text-foreground underline">Budget tracker MAD guide</Link></li>
        </ul>
      </div>
      <p className="mt-16 text-muted-foreground">{s.stillStuck}{" "}<a href="/contact" className="text-foreground underline underline-offset-4 hover:no-underline">{s.getInTouch}</a>.</p>
    </StaticPageShell>
  );
}
