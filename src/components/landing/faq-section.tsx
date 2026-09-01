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

  // A translated answer may be phrased without repeating its link label.
  // In that case, preserve the complete answer rather than rendering the
  // answer plus a duplicate/unrelated link.
  if (linkIndex < 0) return <>{faq.answer}</>;

  const before = faq.answer.slice(0, linkIndex);
  const after = faq.answer.slice(linkIndex + faq.link.label.length);

  return (
    <>
      {before}
      <Link
        href={faq.link.href}
        className="text-foreground underline underline-offset-4 hover:no-underline"
      >
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
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="relative overflow-x-clip border-t border-foreground/10 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-12">
        <div className="mb-12 max-w-3xl lg:mb-16">
          <span className="mb-6 block font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {m.landing.faq.eyebrow}
          </span>
          <h2
            id="faq-heading"
            className="font-display text-4xl tracking-tight text-foreground md:text-5xl lg:text-6xl"
          >
            {m.landing.faq.title}
          </h2>
        </div>

        <div className="divide-y divide-foreground/10 border-y border-foreground/10">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-6 lg:py-8">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-xl font-medium text-foreground marker:content-none lg:text-2xl">
                {faq.question}
                <span
                  aria-hidden="true"
                  className="font-mono text-2xl font-normal text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-3xl pt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">
                <FaqAnswer faq={faq} />
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
