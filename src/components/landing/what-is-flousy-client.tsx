"use client";

import { useLightLanguage } from "@/lib/i18n-light";
import { FLOUSY_FACTUAL_DESCRIPTION } from "@/lib/seo";

export function WhatIsFlousySectionClient() {
  const { messages: m } = useLightLanguage();

  return (
    <section
      aria-labelledby="what-is-flousy"
      className="relative border-y border-foreground/10 bg-foreground/[0.02] py-16 lg:py-20"
    >
      <div className="mx-auto grid max-w-[1400px] gap-6 px-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.6fr)] lg:gap-16 lg:px-12">
        <h2
          id="what-is-flousy"
          className="font-display text-3xl tracking-tight text-foreground lg:text-4xl"
        >
          {m.landing.whatIsFlousy.title}
        </h2>
        <p className="max-w-4xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
          {FLOUSY_FACTUAL_DESCRIPTION}
        </p>
      </div>
    </section>
  );
}
