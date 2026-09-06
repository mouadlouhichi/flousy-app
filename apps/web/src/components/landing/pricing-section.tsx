"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useLightLanguage } from "@/lib/i18n-light";
import { useAuthStatus } from '@/lib/auth-status';
import { isDemoMode } from '@/lib/demo-mode';

/*
 * Launch pricing intentionally contains no guessed paid price or billing
 * toggle. The later CMI/Stripe adapter will provide server-owned offers; until
 * then the only Pro offer is the one-time, no-card 90-day trial.
 */

const plansBase = [
  { popular: false },
  { popular: true },
];

export function PricingSection() {
  const { messages: m, intlLocale, isRTL } = useLightLanguage();
  const formatPlanNumber = (value: number) =>
    new Intl.NumberFormat(intlLocale, { minimumIntegerDigits: 2, useGrouping: false }).format(value);
  const { signedIn: user } = useAuthStatus();
  // Read after mount: `localStorage` does not exist during prerender, so
  // resolving it here in render made the CTA differ between the served HTML and
  // the first client render (a hydration mismatch on a public page).
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => {
    setIsDemo(isDemoMode());
  }, []);
  const isLoggedIn = Boolean(user || isDemo);
  const pricingData = m.landing.pricing;

  return (
    <section id="pricing" className="relative py-32 lg:py-40 border-t border-foreground/10 overflow-x-clip">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="max-w-3xl mb-20">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-6">
            {pricingData.eyebrow}
          </span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-6">
            {pricingData.titleLine1}
            <br />
            <span className="text-stroke">{pricingData.titleLine2}</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            {pricingData.description}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-px bg-foreground/10 max-w-4xl">
          {pricingData.plans.map((planData, idx) => {
            const priceInfo = plansBase[idx] || { popular: false };
            return (
              <div
                key={planData.name || idx}
                className={`relative p-8 lg:p-12 bg-background ${
                  priceInfo.popular ? "md:-my-4 md:py-12 lg:py-16 border-2 border-primary" : ""
                }`}
              >
              {priceInfo.popular && (
                <span className="absolute -top-3 start-8 px-3 py-1 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-widest">
                  {pricingData.mostPopular}
                </span>
              )}

              {/* Plan Header */}
              <div className="mb-8">
                <span className="font-mono text-xs text-muted-foreground">
                  {formatPlanNumber(idx + 1)}
                </span>
                <h3 className="font-display text-3xl text-foreground mt-2">{planData.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">{planData.description}</p>
              </div>

              {/* Price */}
              <div className="mb-8 pb-8 border-b border-foreground/10">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-5xl lg:text-6xl text-foreground">
                    {idx === 1 ? pricingData.trialPriceLabel : pricingData.freePriceLabel}
                  </span>
                  <span className="text-muted-foreground">
                    {idx === 1 ? pricingData.trialPeriod : pricingData.freePeriod}
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-10">
                {(planData.features || []).map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href={isLoggedIn ? "/dashboard" : "/login"}
                className={`w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                  priceInfo.popular
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "border border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground/5"
                }`}
              >
                {isLoggedIn ? m.landing.nav.goToDashboard : planData.cta}
                <ArrowRight className={`h-4 w-4 transition-transform ${isRTL ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
              </a>
            </div>
            );
          }
        )}
        </div>

        {/* Bottom Note */}
        <p className="mt-12 text-center text-sm text-muted-foreground">
          {pricingData.bottomNote}
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">
          {m.pro.betaTitle} — {m.pro.betaBody}
        </p>
      </div>
    </section>
  );
}
