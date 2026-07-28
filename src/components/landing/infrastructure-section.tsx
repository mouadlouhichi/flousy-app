"use client";

import { useEffect, useState, useRef } from "react";
import { Check, Lock } from "lucide-react";
import { useLightLanguage } from "@/lib/i18n-light";

const perks = [
  { name: "Track spending across bank, wallet & home", pro: false },
  { name: "4 budgeting styles to choose from", pro: false },
  { name: "Unlimited savings goals", pro: false },
  { name: "See exactly where every dirham went", pro: false },
  { name: "Spot spending trends over months", pro: true },
  { name: "Get notified before you overspend", pro: true },
  { name: "Automatic recurring bills", pro: true },
];

export function InfrastructureSection() {
  const { messages: m } = useLightLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [activePerk, setActivePerk] = useState(0);
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

  useEffect(() => {
    const interval = setInterval(() => {
      setActivePerk((prev) => (prev + 1) % perks.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              {m.landing.infrastructure.eyebrow}
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Start free.
              <br />
              Upgrade when ready.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12">
              Everything you need to budget well is free, forever. When you
              want deeper insight into your habits and a little help staying
              on track, Flousy Pro is right there.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">Free</div>
                <div className="text-sm text-muted-foreground">Core budgeting</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">3</div>
                <div className="text-sm text-muted-foreground">Places to track cash</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">Pro</div>
                <div className="text-sm text-muted-foreground">Smarter insights</div>
              </div>
            </div>
          </div>

          {/* Right: Perks list */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-foreground/10">
              {/* Header */}
              <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
                <span className="text-sm font-mono text-muted-foreground">What you get</span>
                <span className="flex items-center gap-2 text-xs font-mono text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Free to start
                </span>
              </div>

              {/* Perks */}
              <div>
                {perks.map((perk, index) => (
                  <div
                    key={perk.name}
                    className={`px-6 py-5 border-b border-foreground/5 last:border-b-0 flex items-center justify-between transition-all duration-300 ${
                      activePerk === index ? "bg-foreground/[0.02]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                          activePerk === index ? "bg-foreground" : "bg-foreground/20"
                        }`}
                      />
                      <div className="font-medium">{perk.name}</div>
                    </div>
                    {perk.pro ? (
                      <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                        <Lock className="w-3 h-3" />
                        Pro
                      </span>
                    ) : (
                      <Check className="w-4 h-4 text-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
