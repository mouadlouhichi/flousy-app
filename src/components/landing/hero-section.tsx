'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useLightLanguage } from "@/lib/i18n-light";
import { useAuth } from '@/lib/auth-context';
import { AnimatedSphere } from './animated-sphere';

export function HeroSection() {
  const { messages: m, isRTL } = useLightLanguage();
  const { user } = useAuth();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('flousy_demo_mode') === 'true';
  const isLoggedIn = Boolean(user || isDemo);
  const words = m.landing.hero.words;
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setWordIndex((current) => (current + 1) % words.length);
    }, 2500);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 h-[600px] w-[600px] -translate-y-1/2 opacity-40 lg:h-[800px] lg:w-[800px] ${isRTL ? 'left-0' : 'right-0'}`}
      >
        <AnimatedSphere />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-30"
      >
        {[...Array(8)].map((_, index) => (
          <div
            key={`h-${index}`}
            className="absolute left-0 right-0 h-px bg-foreground/10"
            style={{ top: `${12.5 * (index + 1)}%` }}
          />
        ))}
        {[...Array(12)].map((_, index) => (
          <div
            key={`v-${index}`}
            className="absolute bottom-0 top-0 w-px bg-foreground/10"
            style={{ left: `${8.33 * (index + 1)}%` }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-32 lg:px-12 lg:py-40">
        <div className="mb-8">
          <span className="inline-flex items-center gap-3 font-mono text-sm text-muted-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-foreground/30" />
            {m.landing.hero.eyebrow}
          </span>
        </div>

        <div className="mb-12">
          <h1 className="font-display text-[clamp(3rem,12vw,10rem)] leading-[0.9] tracking-tight">
            <span className="block">{m.landing.hero.titleLine1}</span>
            <span className="block">
              {m.landing.hero.titleLine2Prefix}{' '}
              <span className="relative inline-block">
                <span key={wordIndex} className="inline-flex">
                  {isRTL ? (
                    words[wordIndex]
                  ) : (
                    words[wordIndex].split('').map((character, index) => (
                      <span
                        key={`${wordIndex}-${index}`}
                        className="animate-char-in inline-block"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {character}
                      </span>
                    ))
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute -bottom-2 left-0 right-0 h-3 bg-foreground/10"
                />
              </span>
            </span>
          </h1>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-24">
          <p className="max-w-xl text-xl leading-relaxed text-muted-foreground lg:text-2xl">
            {m.landing.hero.description}
          </p>

          <div className="flex flex-col items-start gap-4 sm:flex-row lg:-translate-y-6">
            <Button
              asChild
              size="lg"
              className="group h-14 rounded-full bg-primary px-8 text-base text-white hover:bg-primary/90"
            >
              <a href={isLoggedIn ? "/dashboard" : "/login"}>
                {isLoggedIn ? "Go to Dashboard" : m.landing.hero.ctaPrimary}
                <ArrowRight className="ms-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-full border-foreground/20 px-8 text-base hover:bg-foreground/5"
            >
              <a href="#how-it-works">{m.landing.hero.ctaSecondary}</a>
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-24 left-0 right-0 hidden overflow-hidden sm:block">
        <div className="marquee flex gap-16 whitespace-nowrap">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-16" aria-hidden={setIndex === 1}>
              {(m.landing.hero.stats || [
                { value: '4', label: 'budgeting styles to pick from', detail: '50/30/20 & MORE' },
                { value: '3', label: 'places to track your cash', detail: 'BANK · HOME · WALLET' },
                { value: '12', label: 'currencies supported', detail: 'MAD · EUR · USD' },
                { value: '100%', label: 'of your money accounted for', detail: 'NEVER LOST' },
              ]).map((stat) => (
                <div key={`${stat.detail}-${setIndex}`} className="flex items-baseline gap-4">
                  <span className="font-display text-4xl lg:text-5xl">{stat.value}</span>
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                    <span className="mt-1 block font-mono text-xs">{stat.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
