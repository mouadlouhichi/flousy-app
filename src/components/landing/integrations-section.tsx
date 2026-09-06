"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useLightLanguage } from "@/lib/i18n-light";

const CURRENCY_CODES = [
  'MAD', 'EUR', 'USD', 'GBP', 'CAD', 'CHF', 'AED', 'SAR', 'EGP', 'TND', 'DZD', 'XOF',
] as const;


export function IntegrationsSection() {
  const { messages: m, intlLocale } = useLightLanguage();
  const currencyNames = new Intl.DisplayNames([intlLocale], { type: 'currency' });
  const integrations = CURRENCY_CODES.map((name) => ({
    name,
    category: currencyNames.of(name) || name,
  }));
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="integrations" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 lg:mb-24 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            {m.landing.integrations.eyebrow}
            <span className="w-8 h-px bg-foreground/30" />
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-6">
            {m.landing.integrations.titleLine1}
            <br />
            {m.landing.integrations.titleLine2}
          </h2>
          <p className="text-xl text-muted-foreground">
            {m.landing.integrations.description}
          </p>
          {/* Semantic internal linking for Morocco SEO */}
          <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
            Built for Morocco — track in <Link href="/features/multi-currency-mad" className="text-foreground underline underline-offset-4 hover:no-underline">MAD and dirham with our multi-currency budget tracker</Link>. 
            Learn how <Link href="/features/track-bank-home-wallet" className="text-foreground underline underline-offset-4 hover:no-underline">bank, home and wallet balances stay separate</Link> and 
            <Link href="/blog" className="text-foreground underline underline-offset-4 hover:no-underline"> read budgeting guides for cash spending</Link>.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/features/multi-currency-mad" className="inline-flex items-center rounded-full border border-foreground/10 px-4 py-2 text-xs font-medium hover:border-foreground/30 transition-colors">
              Explore MAD & dirham support →
            </Link>
            <Link href="/budgeting-methods" className="inline-flex items-center rounded-full border border-foreground/10 px-4 py-2 text-xs font-medium hover:border-foreground/30 transition-colors">
              4 budgeting methods →
            </Link>
          </div>
        </div>

      </div>
      
      {/* Full-width marquees outside container */}
      <div className="w-full mb-6">
        <div className="flex gap-6 marquee">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-6 shrink-0">
              {integrations.map((integration) => (
                <div
                  key={`${integration.name}-${setIndex}`}
                  className="shrink-0 px-8 py-6 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all duration-300 group"
                >
                  <div className="text-lg font-medium group-hover:translate-x-1 transition-transform">
                    {integration.name}
                  </div>
                  <div className="text-sm text-muted-foreground">{integration.category}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Reverse marquee */}
      <div className="w-full">
        <div className="flex gap-6 marquee-reverse">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-6 shrink-0">
              {[...integrations].reverse().map((integration) => (
                <div
                  key={`${integration.name}-reverse-${setIndex}`}
                  className="shrink-0 px-8 py-6 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all duration-300 group"
                >
                  <div className="text-lg font-medium group-hover:translate-x-1 transition-transform">
                    {integration.name}
                  </div>
                  <div className="text-sm text-muted-foreground">{integration.category}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
