"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLightLanguage } from "@/lib/i18n-light";

const FEATURE_VISUALS = ['deploy', 'ai', 'collab', 'security'] as const;
type FeatureVisual = (typeof FEATURE_VISUALS)[number];

type Feature = {
  number: string;
  title: string;
  description: string;
  visual: FeatureVisual;
  link?: { href: string; anchor: string };
};

function DeployVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <defs>
        <clipPath id="deployClip">
          <rect x="30" y="20" width="140" height="120" rx="4" />
        </clipPath>
      </defs>
      <rect x="30" y="20" width="140" height="120" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <g clipPath="url(#deployClip)">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x="40" y={35 + i * 16} width="120" height="10" rx="2" fill="currentColor" opacity="0.15">
            <animate attributeName="opacity" values="0.15;0.8;0.15" dur="2s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
            <animate attributeName="width" values="20;120;20" dur="2s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </g>
      <circle cx="100" cy="155" r="3" fill="currentColor" opacity="0.3">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function AIVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <circle cx="100" cy="80" r="12" fill="currentColor">
        <animate attributeName="r" values="12;14;12" dur="2s" repeatCount="indefinite" />
      </circle>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i * 60) * (Math.PI / 180);
        const radius = 50;
        const nodeX = (100 + Math.cos(angle) * radius).toFixed(3);
        const nodeY = (80 + Math.sin(angle) * radius).toFixed(3);
        return (
          <g key={i}>
            <line x1="100" y1="80" x2={nodeX} y2={nodeY} stroke="currentColor" strokeWidth="1" opacity="0.3">
              <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
            </line>
            <circle cx={nodeX} cy={nodeY} r="6" fill="none" stroke="currentColor" strokeWidth="2">
              <animate attributeName="r" values="6;8;6" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}
      <circle cx="100" cy="80" r="30" fill="none" stroke="currentColor" strokeWidth="1" opacity="0">
        <animate attributeName="r" values="20;60" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function CollabVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <g>
        <rect x="30" y="50" width="50" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="55" y="85" textAnchor="middle" fontSize="20" fontFamily="monospace" fill="currentColor">A</text>
        <circle cx="55" cy="35" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      </g>
      <g>
        <rect x="120" y="50" width="50" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="145" y="85" textAnchor="middle" fontSize="20" fontFamily="monospace" fill="currentColor">B</text>
        <circle cx="145" cy="35" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      </g>
      <line x1="80" y1="80" x2="120" y2="80" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
        <animate attributeName="stroke-dashoffset" values="0;-8" dur="0.5s" repeatCount="indefinite" />
      </line>
      <circle r="4" fill="currentColor">
        <animateMotion dur="1.5s" repeatCount="indefinite">
          <mpath href="#dataPath" />
        </animateMotion>
      </circle>
      <path id="dataPath" d="M 80 80 L 120 80" fill="none" />
      <g transform="translate(100, 130)">
        <circle r="6" fill="none" stroke="currentColor" strokeWidth="2">
          <animate attributeName="r" values="6;10;6" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

function SecurityVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <path d="M 100 20 L 150 40 L 150 90 Q 150 130 100 145 Q 50 130 50 90 L 50 40 Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M 100 35 L 135 50 L 135 85 Q 135 115 100 128 Q 65 115 65 85 L 65 50 Z" fill="currentColor" opacity="0.1">
        <animate attributeName="opacity" values="0.1;0.2;0.1" dur="2s" repeatCount="indefinite" />
      </path>
      <rect x="85" y="70" width="30" height="25" rx="3" fill="currentColor" />
      <path d="M 90 70 L 90 60 Q 90 50 100 50 Q 110 50 110 60 L 110 70" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="100" cy="80" r="4" fill="white" />
      <rect x="98" y="82" width="4" height="8" fill="white" />
      <line x1="60" y1="60" x2="140" y2="60" stroke="currentColor" strokeWidth="1" opacity="0">
        <animate attributeName="y1" values="40;120;40" dur="3s" repeatCount="indefinite" />
        <animate attributeName="y2" values="40;120;40" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.5;0" dur="3s" repeatCount="indefinite" />
      </line>
    </svg>
  );
}

function AnimatedVisual({ type }: { type: FeatureVisual }) {
  switch (type) {
    case "deploy": return <DeployVisual />;
    case "ai": return <AIVisual />;
    case "collab": return <CollabVisual />;
    case "security": return <SecurityVisual />;
    default: return <DeployVisual />;
  }
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setIsVisible(true); }, { threshold: 0.2 });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={cardRef} className={`group relative transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`} style={{ transitionDelay: `${index * 100}ms` }}>
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 py-12 lg:py-20 border-b border-foreground/10">
        <div className="shrink-0"><span className="font-mono text-sm text-muted-foreground">{feature.number}</span></div>
        <div className="flex-1 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-3xl lg:text-4xl font-display mb-4 group-hover:translate-x-2 transition-transform duration-500">{feature.title}</h3>
            <p className="text-lg text-muted-foreground leading-relaxed">{feature.description}</p>
            {feature.link && (
              <Link href={feature.link.href} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline">
                {feature.link.anchor} →
              </Link>
            )}
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="w-48 h-40 text-foreground"><AnimatedVisual type={feature.visual} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const { messages: m } = useLightLanguage();
  const internalLinks: Record<number, { href: string; anchor: string }> = {
    0: { href: '/blog/what-its-for-vs-where-it-is', anchor: 'Learn why purpose and location must stay separate' },
    1: { href: '/budgeting-methods', anchor: 'Compare 4 budgeting methods: 50/30/20, zero-based, envelope, pay-yourself-first' },
    2: { href: '/features/track-bank-home-wallet', anchor: 'See how bank, home and wallet tracking works' },
    3: { href: '/features/expense-tracking', anchor: 'How expense deletion and balance reversal works' },
  };
  const features: Feature[] = m.landing.features.items.map((item, index) => ({
    ...item,
    number: String(index + 1).padStart(2, '0'),
    visual: FEATURE_VISUALS[index] || 'deploy',
    link: internalLinks[index],
  }));
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setIsVisible(true); }, { threshold: 0.1 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" ref={sectionRef} className="relative overflow-x-clip py-24 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />{m.landing.features.eyebrow}
          </span>
          <h2 className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            {m.landing.features.titleLine1}<br /><span className="text-muted-foreground">{m.landing.features.titleLine2}</span>
          </h2>
          <p className="mt-6 max-w-2xl text-muted-foreground">
            SmartJib is a <Link href="/" className="text-foreground underline underline-offset-4 hover:no-underline">free private budget tracker</Link> built for Morocco — it supports <Link href="/features/multi-currency-mad" className="text-foreground underline underline-offset-4 hover:no-underline">MAD, dirham and 12 currencies</Link> and keeps your money places separate from budget envelopes. Explore <Link href="/budgeting-methods" className="text-foreground underline underline-offset-4 hover:no-underline">budgeting methods</Link> and <Link href="/blog" className="text-foreground underline underline-offset-4 hover:no-underline">budgeting guides</Link>.
          </p>
        </div>
        <div>{features.map((feature, index) => (<FeatureCard key={feature.number} feature={feature} index={index} />))}</div>
      </div>
    </section>
  );
}
