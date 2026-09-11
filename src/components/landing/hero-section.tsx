'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useLightLanguage } from "@/lib/i18n-light";
import { formatLocalizedPercent } from "@/lib/i18n";
import { useAuthStatus } from '@/lib/auth-status';
import { isDemoMode } from '@/lib/demo-mode';
import { AnimatedSphere } from './animated-sphere';

export function HeroSection() {
  const { messages: m, isRTL, intlLocale } = useLightLanguage();
  const formatStatValue = (value: string) => {
    const percent = /^(\d+(?:\.\d+)?)%$/.exec(value);
    if (percent) return formatLocalizedPercent(Number(percent[1]), intlLocale);
    if (/^\d+$/.test(value)) return new Intl.NumberFormat(intlLocale).format(Number(value));
    return value;
  };
  const { signedIn: user } = useAuthStatus();
  // `isDemoMode()` reads localStorage, which does not exist while the page is
  // prerendered — resolving it during render made `isLoggedIn` (and the CTA text
  // derived from it) differ between the served HTML and the first client render,
  // i.e. a hydration mismatch on the landing page. It is applied after mount.
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => {
    setIsDemo(isDemoMode());
  }, []);
  const isLoggedIn = Boolean(user || isDemo);
  const words = m.landing.hero.words;
  const [wordIndex, setWordIndex] = useState(0);
  // The per-character blur-in animation (`.animate-char-in`) starts every
  // glyph at opacity:0 with a 0.5s animation + up to ~0.5s of stagger delay.
  // Applied to the FIRST render, the hero headline — the LCP element — isn't
  // fully painted until the animation finishes, adding ~1s to LCP. The staged
  // entrance now only plays for rotation N>0; the initial word paints
  // instantly (and identically between SSR and hydration).
  const [hasRotated, setHasRotated] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setWordIndex((current) => (current + 1) % words.length);
      setHasRotated(true);
    }, 2500);

    return () => window.clearInterval(interval);
    // The interval only needs the rotation length, but a locale with fewer hero
    // words must reset it, or the index wraps past the end of the list.
  }, [words.length]);

  return (
    <section className="backdrop-mint relative flex min-h-screen flex-col justify-center overflow-hidden">
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
            className="absolute inset-x-0 h-px bg-forest/10 dark:bg-lime/10"
            style={{ top: `${12.5 * (index + 1)}%` }}
          />
        ))}
        {[...Array(12)].map((_, index) => (
          <div
            key={`v-${index}`}
            className="absolute bottom-0 top-0 w-px bg-forest/10 dark:bg-lime/10"
            style={{ left: `${8.33 * (index + 1)}%` }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-32 lg:px-12 lg:py-40">
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest/80 py-1.5 pe-4 ps-1.5 text-[13px] font-medium text-on-surface shadow-ambient backdrop-blur">
            <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-lime text-forest-deep">
              <span className="size-1.5 rounded-full bg-forest-deep" />
            </span>
            {m.landing.hero.eyebrow}
          </span>
        </div>

        <div className="mb-12">
          <h1 className="font-display text-[clamp(3rem,11vw,9rem)] font-semibold leading-[0.92] rtl:leading-tight tracking-[-0.04em] text-on-surface">
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
                        className={hasRotated ? 'animate-char-in inline-block' : 'inline-block'}
                        style={hasRotated ? { animationDelay: `${index * 50}ms` } : undefined}
                      >
                        {character}
                      </span>
                    ))
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-[0.06em] -z-10 h-[0.28em] rounded-full bg-lime dark:bg-lime/30"
                />
              </span>
            </span>
          </h1>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-24">
          <p className="max-w-xl text-lg leading-relaxed text-on-surface-variant lg:text-xl">
            {m.landing.hero.description}
          </p>

          <div className="flex flex-col items-start gap-4 sm:flex-row lg:-translate-y-6">
            <Button
              asChild
              size="lg"
              className="group h-14 rounded-full bg-primary px-8 text-base text-on-primary shadow-[0_12px_28px_-10px_rgba(15,59,54,0.55)] hover:bg-primary-hover"
            >
              <a href={isLoggedIn ? "/dashboard" : "/login"}>
                {isLoggedIn ? m.landing.nav.goToDashboard : m.landing.hero.ctaPrimary}
                <ArrowRight className={`ms-2 h-4 w-4 transition-transform ${isRTL ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-full border-outline-variant bg-surface-container-lowest px-8 text-base text-on-surface hover:bg-surface-container-high"
            >
              <a href="#how-it-works">{m.landing.hero.ctaSecondary}</a>
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-24 hidden overflow-hidden sm:block">
        <div className="marquee flex gap-16 whitespace-nowrap">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-16" aria-hidden={setIndex === 1}>
              {m.landing.hero.stats.map((stat) => (
                <div key={`${stat.detail}-${setIndex}`} className="flex items-baseline gap-4">
                  <span className="font-display text-4xl font-semibold tracking-[-0.03em] text-on-surface lg:text-5xl">{formatStatValue(stat.value)}</span>
                  <span className="text-sm text-on-surface-variant">
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
