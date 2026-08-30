"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useLightLanguage } from "@/lib/i18n-light";
import { useAuth } from '@/lib/auth-context';

const plansBase = [
  { price: { monthly: 0, annual: 0 }, popular: false },
  { price: { monthly: 29, annual: 19 }, popular: true },
];

export function PricingSection() {
  const { messages: m } = useLightLanguage();
  const { user } = useAuth();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('flousy_demo_mode') === 'true';
  const isLoggedIn = Boolean(user || isDemo);
  const pricingData = m.landing.pricing;
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="pricing" className="relative py-32 lg:py-40 border-t border-foreground/10 overflow-x-clip">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="max-w-3xl mb-20">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-6">
            {pricingData?.eyebrow || 'Pricing'}
          </span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-6">
            {pricingData?.titleLine1 || 'Free to start.'}
            <br />
            <span className="text-stroke">{pricingData?.titleLine2 || "Pro when you're ready."}</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            {pricingData?.description || 'Budget with confidence at no cost. Upgrade anytime for deeper insight into your habits and a little extra help staying on track.'}
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center gap-4 mb-16">
          <span
            className={`text-sm transition-colors ${
              !isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {pricingData?.monthly || 'Monthly'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isAnnual}
            aria-label="Use annual billing"
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative w-14 h-7 bg-foreground/10 rounded-full p-1 transition-colors hover:bg-foreground/20"
          >
            <div
              className={`w-5 h-5 bg-foreground rounded-full transition-transform duration-300 ${
                isAnnual ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm transition-colors ${
              isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {pricingData?.annual || 'Annual'}
          </span>
          {isAnnual && (
            <span className="ml-2 px-2 py-1 bg-primary text-card  text-xs font-mono">
              {pricingData?.save34 || 'Save 34%'}
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-px bg-foreground/10 max-w-4xl">
          {(pricingData?.plans || []).map((planData, idx) => {
            const priceInfo = plansBase[idx] || { price: { monthly: 0, annual: 0 }, popular: false };
            return (
              <div
                key={planData.name || idx}
                className={`relative p-8 lg:p-12 bg-background ${
                  priceInfo.popular ? "md:-my-4 md:py-12 lg:py-16 border-2 border-primary" : ""
                }`}
              >
              {priceInfo.popular && (
                <span className="absolute -top-3 left-8 px-3 py-1 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-widest">
                  {pricingData?.mostPopular || 'Most popular'}
                </span>
              )}

              {/* Plan Header */}
              <div className="mb-8">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-3xl text-foreground mt-2">{planData.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">{planData.description}</p>
              </div>

              {/* Price */}
              <div className="mb-8 pb-8 border-b border-foreground/10">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-5xl lg:text-6xl text-foreground">
                    ${isAnnual ? priceInfo.price.annual : priceInfo.price.monthly}
                  </span>
                  <span className="text-muted-foreground">{pricingData?.perMonth || '/month'}</span>
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
                {isLoggedIn ? "Go to Dashboard" : planData.cta}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
            );
          }
        )}
        </div>

        {/* Bottom Note */}
        <p className="mt-12 text-center text-sm text-muted-foreground">
          {pricingData?.bottomNote || 'Your budget stays private, always. No credit card required to start.'}
        </p>
      </div>
    </section>
  );
}
