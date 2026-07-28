"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: "I",
    title: "Tell us about your income",
    description: "Add what you earn and a few regular bills. It takes about two minutes, and you can always change it later.",
    snapshot: {
      label: "Monthly income",
      lines: [
        { text: "Salary", value: "12,000 MAD" },
        { text: "Side income", value: "800 MAD" },
        { text: "Total", value: "12,800 MAD" },
      ],
    },
  },
  {
    number: "II",
    title: "Pick a budgeting style",
    description: "Flousy splits your income into needs, wants and savings for you. Prefer a different balance? Switch styles anytime.",
    snapshot: {
      label: "Your monthly plan",
      lines: [
        { text: "Needs", value: "50%" },
        { text: "Wants", value: "30%" },
        { text: "Savings", value: "20%" },
      ],
    },
  },
  {
    number: "III",
    title: "Log spending as it happens",
    description: "Add an expense in seconds and choose whether it came from your bank, your wallet, or cash at home. Your plan updates instantly.",
    snapshot: {
      label: "Today",
      lines: [
        { text: "Groceries · Wallet", value: "-85 MAD" },
        { text: "Coffee · Wallet", value: "-18 MAD" },
        { text: "Remaining this month", value: "3,240 MAD" },
      ],
    },
  },
];

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

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
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-foreground text-background overflow-hidden"
    >
      {/* Diagonal lines pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 40px,
            currentColor 40px,
            currentColor 41px
          )`
        }} />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-background/50 mb-6">
            <span className="w-8 h-px bg-background/30" />
            Getting started
          </span>
          <h2
            className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Three steps.
            <br />
            <span className="text-background/50">A clearer month ahead.</span>
          </h2>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Steps */}
          <div className="space-y-0">
            {steps.map((step, index) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`w-full text-left py-8 border-b border-background/10 transition-all duration-500 group ${
                  activeStep === index ? "opacity-100" : "opacity-40 hover:opacity-70"
                }`}
              >
                <div className="flex items-start gap-6">
                  <span className="font-display text-3xl text-background/30">{step.number}</span>
                  <div className="flex-1">
                    <h3 className="text-2xl lg:text-3xl font-display mb-3 group-hover:translate-x-2 transition-transform duration-300">
                      {step.title}
                    </h3>
                    <p className="text-background/60 leading-relaxed">
                      {step.description}
                    </p>
                    
                    {/* Progress indicator */}
                    {activeStep === index && (
                      <div className="mt-4 h-px bg-background/20 overflow-hidden">
                        <div 
                          className="h-full bg-background w-0"
                          style={{
                            animation: 'progress 5s linear forwards'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Snapshot display */}
          <div className="lg:sticky lg:top-32 self-start">
            <div className="border border-background/10 overflow-hidden">
              {/* Window header */}
              <div className="px-6 py-4 border-b border-background/10 flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-background/20" />
                  <div className="w-3 h-3 rounded-full bg-background/20" />
                  <div className="w-3 h-3 rounded-full bg-background/20" />
                </div>
                <span className="text-xs font-mono text-background/40">{steps[activeStep].snapshot.label}</span>
              </div>

              {/* Snapshot content */}
              <div className="p-8 min-h-[280px] flex flex-col justify-center gap-6">
                {steps[activeStep].snapshot.lines.map((line, lineIndex) => (
                  <div
                    key={`${activeStep}-${lineIndex}`}
                    className="flex items-baseline justify-between snapshot-line-reveal"
                    style={{ animationDelay: `${lineIndex * 120}ms` }}
                  >
                    <span className="text-background/60 text-lg">{line.text}</span>
                    <span className="font-display text-2xl lg:text-3xl">{line.value}</span>
                  </div>
                ))}
              </div>

              {/* Status */}
              <div className="px-6 py-4 border-t border-background/10 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-mono text-background/40">Synced</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        
        .snapshot-line-reveal {
          opacity: 0;
          transform: translateY(8px);
          animation: snapshotReveal 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        @keyframes snapshotReveal {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
