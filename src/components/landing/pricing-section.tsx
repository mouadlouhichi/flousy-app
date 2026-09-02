"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useLightLanguage } from "@/lib/i18n-light";
import { formatLocalizedPercent } from "@/lib/i18n";
import { useAuthStatus } from '@/lib/auth-status';
import { isDemoMode } from '@/lib/demo-mode';

/*
 * The numbers a visitor is quoted and the numbers the app would charge have to
 * come from the same place, and they did not: this section hard-coded 29/19
 * through a `USD` formatter while the in-app checkout used 4.99/39.99 from
 * `PRO_PRICING`. No payment provider is configured in this deployment, so any
 * price shown here would be unbuyable and every "Save 34%" toggle would be a
 * control that changes nothing. Pro is therefore presented as included for free
 * during the launch period, and `BILLING_LIVE` (imported from `lib/payments`,
 * the single billing switch) flips when a real provider exists — at which
 * point these figures must be deleted in favour of the provider's prices.
 */
import { BILLING_LIVE } from '@/lib/payments';

const plansBase = [
  { price: { monthly: 0, annual: 0 }, popular: false },
  { price: { monthly: 29, annual: 19 }, popular: true },
];

function formatPrice(price: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

export function PricingSection() {
  const { messages: m, t, intlLocale, isRTL } = useLightLanguage();
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
  const [isAnnual, setIsAnnual] = useState(true);

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

        {/* Billing Toggle */}
        <div className={`flex items-center gap-4 ${BILLING_LIVE ? 'mb-16' : 'mb-16 hidden'}`}>
          <span
            className={`text-sm transition-colors ${
              !isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {pricingData.monthly}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isAnnual}
            aria-label={pricingData.useAnnualBilling}
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative w-14 h-7 bg-foreground/10 rounded-full p-1 transition-colors hover:bg-foreground/20"
          >
            <div
              className={`w-5 h-5 bg-foreground rounded-full transition-transform duration-300 ${
                isAnnual ? "translate-x-7 rtl:-translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm transition-colors ${
              isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {pricingData.annual}
          </span>
          {isAnnual && (
            <span className="ms-2 px-2 py-1 bg-primary text-card text-xs font-mono">
              {t(pricingData.save34, { percent: formatLocalizedPercent(34, intlLocale) })}
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-px bg-foreground/10 max-w-4xl">
          {pricingData.plans.map((planData, idx) => {
            const priceInfo = plansBase[idx] || { price: { monthly: 0, annual: 0 }, popular: false };
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
                    {BILLING_LIVE
                      ? formatPrice(isAnnual ? priceInfo.price.annual : priceInfo.price.monthly, intlLocale)
                      : formatPrice(0, intlLocale)}
                  </span>
                  <span className="text-muted-foreground">{pricingData.perMonth}</span>
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
        {!BILLING_LIVE && (
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">
            {m.pro.trialTitle} — {m.pro.trialBody}
          </p>
        )}
      </div>
    </section>
  );
}
