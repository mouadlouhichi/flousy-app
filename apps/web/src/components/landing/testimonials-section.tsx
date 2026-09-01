"use client";

import { useEffect, useState } from "react";
import { useLightLanguage } from "@/lib/i18n-light";
import { formatLocalizedPercent } from "@/lib/i18n";



export function TestimonialsSection() {
  const { messages: m, t, intlLocale } = useLightLanguage();
  const formatIndex = (value: number) =>
    new Intl.NumberFormat(intlLocale, { minimumIntegerDigits: 2, useGrouping: false }).format(value);
  const testimonials = m.landing.testimonials.items;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % testimonials.length);
        setIsAnimating(false);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  const activeTestimonial = testimonials[activeIndex];

  return (
    <section className="relative py-32 lg:py-40 border-t border-foreground/10 lg:pb-14 overflow-x-clip">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Section Label */}
        <div className="flex items-center gap-4 mb-16">
          <h2 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            {m.landing.testimonials.eyebrow}
          </h2>
          <div className="flex-1 h-px bg-foreground/10" />
          <span className="font-mono text-xs text-muted-foreground">
            {formatIndex(activeIndex + 1)} / {formatIndex(testimonials.length)}
          </span>
        </div>

        {/*
          These quotes are written for the landing page, not collected from
          users. Presented as customer testimony without a label that is a
          deceptive commercial practice (UGC/FTC guidance, and the equivalent
          rules in the EU and France), so the section says what it is.
        */}
        <p className="-mt-12 mb-12 text-xs text-muted-foreground">
          {m.landing.testimonials.illustrative}
        </p>

        {/* Main Quote */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-20">
          <div className="lg:col-span-8">
            <blockquote
              className={`transition-all duration-300 ${
                isAnimating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
              }`}
            >
              <p className="font-display text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight text-foreground">
                "{activeTestimonial.quote}"
              </p>
            </blockquote>

            {/* Author */}
            <div
              className={`mt-12 flex items-center gap-6 transition-all duration-300 delay-100 ${
                isAnimating ? "opacity-0" : "opacity-100"
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-foreground/5 border border-foreground/10 flex items-center justify-center">
                <span className="font-display text-2xl text-foreground">
                  {activeTestimonial.author.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">{activeTestimonial.author}</p>
                <p className="text-muted-foreground">
                  {activeTestimonial.role}, {activeTestimonial.company}
                </p>
              </div>
            </div>
          </div>

          {/* Metric Highlight */}
          <div className="lg:col-span-4 flex flex-col justify-center">
            <div
              className={`p-8 border border-foreground/10 transition-all duration-300 ${
                isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
              }`}
            >
              <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-4">
                {m.landing.testimonials.keyResult}
              </span>
              <p className="font-display text-3xl md:text-4xl text-foreground">
                {t(activeTestimonial.metric, { percent: formatLocalizedPercent(20, intlLocale) })}
              </p>
            </div>

            {/* Navigation Dots */}
            <div className="flex gap-2 mt-8">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={t(m.landing.testimonials.showTestimonial, { number: new Intl.NumberFormat(intlLocale).format(idx + 1) })}
                  onClick={() => {
                    setIsAnimating(true);
                    setTimeout(() => {
                      setActiveIndex(idx);
                      setIsAnimating(false);
                    }, 300);
                  }}
                  className={`h-2 transition-all duration-300 ${
                    idx === activeIndex
                      ? "w-8 bg-foreground"
                      : "w-2 bg-foreground/20 hover:bg-foreground/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Company Logos Marquee Label */}
        <div className="mt-24 pt-12 border-t border-foreground/10">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-8 text-center">
            {m.landing.testimonials.trustedBy}
          </p>
        </div>
      </div>
      
      {/* Full-width marquee outside container */}
      <div className="w-full">
        <div className="flex gap-16 items-center marquee">
          {[...Array(2)].map((_, setIdx) => (
            <div key={setIdx} className="flex gap-16 items-center shrink-0">
              {["MAD", "EUR", "USD", "GBP", "CAD", "CHF", "AED", "SAR", "EGP", "TND", "DZD", "XOF"].map(
                (company) => (
                  <span
                    key={`${setIdx}-${company}`}
                    className="font-display text-xl md:text-2xl text-foreground/30 whitespace-nowrap hover:text-foreground transition-colors duration-300"
                  >
                    {company}
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
