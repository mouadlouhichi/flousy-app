"use client";

import Link from 'next/link';
import { useLightLanguage } from "@/lib/i18n-light";

type LandingFaq = {
  question: string;
  answer: string;
  link?: {
    label: string;
    href: string;
  };
};

function FaqAnswer({ faq }: { faq: LandingFaq }) {
  if (!faq.link) return <>{faq.answer}</>;

  const linkIndex = faq.link.label ? faq.answer.indexOf(faq.link.label) : -1;
  if (linkIndex < 0) return <>{faq.answer}</>;

  const before = faq.answer.slice(0, linkIndex);
  const after = faq.answer.slice(linkIndex + faq.link.label.length);

  return (
    <>
      {before}
      <Link href={faq.link.href} className="text-foreground underline underline-offset-4 hover:no-underline">
        {faq.link.label}
      </Link>
      {after}
    </>
  );
}

export function FaqSection() {
  const { messages: m } = useLightLanguage();
  const faqs = m.landing.faq.items;

  return (
    <section id="faq" aria-labelledby="faq-heading" className="relative overflow-x-clip border-t border-foreground/10 py-24 lg:py-32">
      <div className="mx-auto max-w-5xl px-6 lg:px-12">
        <div className="mb-12 max-w-3xl lg:mb-16">
          <span className="mb-6 block font-mono text-xs uppercase tracking-widest text-muted-foreground">{m.landing.faq.eyebrow}</span>
          <h2 id="faq-heading" className="font-display text-4xl tracking-tight text-foreground md:text-5xl lg:text-6xl">{m.landing.faq.title}</h2>
          <p className="mt-6 text-muted-foreground">
            Learn more: <Link href="/features/multi-currency-mad" className="text-foreground underline underline-offset-4 hover:no-underline">Budget tracker MAD guide</Link> · <Link href="/budgeting-methods" className="text-foreground underline underline-offset-4 hover:no-underline">4 budgeting methods explained</Link> · <Link href="/blog" className="text-foreground underline underline-offset-4 hover:no-underline">Budgeting guides</Link>
          </p>
        </div>

        <div className="divide-y divide-foreground/10 border-y border-foreground/10">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-6 lg:py-8">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-xl font-medium text-foreground marker:content-none lg:text-2xl">
                {faq.question}
                <span aria-hidden="true" className="font-mono text-2xl font-normal text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-3xl pt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">
                <FaqAnswer faq={faq} />
              </p>
            </details>
          ))}
          {/* Additional SEO FAQs with internal linking */}
          <details className="group py-6 lg:py-8">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-xl font-medium text-foreground marker:content-none lg:text-2xl">
              What budgeting methods does SmartJib support?
              <span aria-hidden="true" className="font-mono text-2xl font-normal text-muted-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="max-w-3xl pt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">
              SmartJib supports 4 budgeting methods: <Link href="/budgeting-methods/50-30-20-rule" className="text-foreground underline">50/30/20 rule (50% needs, 30% wants, 20% savings)</Link>, <Link href="/budgeting-methods/zero-based-budgeting" className="text-foreground underline">zero-based budgeting</Link>, <Link href="/budgeting-methods/envelope-budgeting" className="text-foreground underline">envelope budgeting</Link>, and <Link href="/budgeting-methods/pay-yourself-first" className="text-foreground underline">pay-yourself-first</Link>. Compare them in our <Link href="/budgeting-methods" className="text-foreground underline">budgeting methods hub</Link>.
            </p>
          </details>
          <details className="group py-6 lg:py-8">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-xl font-medium text-foreground marker:content-none lg:text-2xl">
              How does SmartJib track cash and wallet spending in Morocco?
              <span aria-hidden="true" className="font-mono text-2xl font-normal text-muted-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="max-w-3xl pt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">
              SmartJib separates what money is for from where it sits. Learn <Link href="/blog/what-its-for-vs-where-it-is" className="text-foreground underline">why purpose and location must stay separate</Link> and <Link href="/features/track-bank-home-wallet" className="text-foreground underline">how bank, home and wallet tracking works</Link>. For cash, see <Link href="/blog/track-cash-wallet-spending" className="text-foreground underline">wallet leak guide</Link> and <Link href="/features/expense-tracking" className="text-foreground underline">expense tracking feature</Link>. Supports <Link href="/features/multi-currency-mad" className="text-foreground underline">MAD and dirham</Link>.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
