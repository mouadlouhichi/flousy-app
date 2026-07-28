import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { AnimatedSphere } from './animated-sphere';

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1/2 h-[600px] w-[600px] -translate-y-1/2 opacity-40 lg:h-[800px] lg:w-[800px]"
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
            A private, mobile-first budget tracker
          </span>
        </div>

        <div className="mb-12">
          <h1 className="font-display text-[clamp(3rem,10vw,9rem)] leading-[0.9] tracking-tight">
            <span className="block">Budget your needs</span>
            <span className="block">and wants.</span>
            <span className="block text-muted-foreground">Track every money place.</span>
          </h1>
        </div>

        <div className="grid items-end gap-12 lg:grid-cols-2 lg:gap-24">
          <p className="max-w-xl text-xl leading-relaxed text-muted-foreground lg:text-2xl">
            Flousy keeps budget envelopes—needs, wants, and savings—separate
            from the bank, home, or wallet where your money is held.
          </p>

          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="group h-14 rounded-full bg-primary px-8 text-base text-card hover:bg-primary/90"
            >
              <a href="/login">
                Start budgeting free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-full border-foreground/20 px-8 text-base hover:bg-foreground/5"
            >
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-16 left-0 right-0 hidden overflow-hidden sm:block lg:bottom-20">
        <div className="marquee flex gap-16 whitespace-nowrap">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-16" aria-hidden={setIndex === 1}>
              {[
                {
                  value: '4',
                  label: 'budgeting strategies',
                  detail: '50/30/20 · ZERO-BASED · ENVELOPE · PAY-FIRST',
                },
                {
                  value: '3',
                  label: 'money places',
                  detail: 'BANK · HOME · WALLET',
                },
                {
                  value: '12',
                  label: 'currencies supported',
                  detail: 'MAD · EUR · USD · GBP · AND 8 MORE',
                },
                {
                  value: '0',
                  label: 'bank connections',
                  detail: 'MANUAL ENTRY FOR CONTROL',
                },
              ].map((stat) => (
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
