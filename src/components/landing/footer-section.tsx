"use client";

import Image from "next/image";
import { useLightLanguage } from "@/lib/i18n-light";
import { AnimatedWave } from "./animated-wave";

export function FooterSection() {
  const { messages: { common, landing: { footer: ft } } } = useLightLanguage();

  const footerLinks = [
    { title: ft.product, links: [
      { name: "Features Hub", href: '/features' },
      { name: "Budget Tracker MAD & Dirham", href: '/features/multi-currency-mad' },
      { name: "Bank, Home, Wallet Tracking", href: '/features/track-bank-home-wallet' },
      { name: "No Bank Connection Privacy", href: '/features/no-bank-connection' },
    ]},
    { title: "Budgeting Methods", links: [
      { name: "All Methods Explained", href: '/budgeting-methods' },
      { name: "50/30/20 Rule", href: '/budgeting-methods/50-30-20-rule' },
      { name: "Envelope Budgeting", href: '/budgeting-methods/envelope-budgeting' },
      { name: "Zero-Based Budgeting", href: '/budgeting-methods/zero-based-budgeting' },
    ]},
    { title: ft.support, links: [
      { name: "Budgeting Guides & Money Tips", href: '/blog' },
      { name: "Why Purpose vs Location Matters", href: '/blog/what-its-for-vs-where-it-is' },
      { name: ft.helpCenter, href: '/help' },
      { name: ft.contactUs, href: '/contact' },
    ]},
    { title: ft.company, links: [
      { name: ft.about, href: '/about' },
      { name: "About Private Budget Tracker", href: '/about' },
      { name: ft.careers, href: '/careers' },
      { name: "Free Budget Tracker Morocco", href: '/' },
    ]},
    { title: ft.legalCol, links: [
      { name: ft.privacyPolicy, href: '/privacy' },
      { name: ft.termsOfService, href: '/terms' },
      { name: ft.cookiePolicy, href: '/cookies' },
    ]},
  ];
  return (
    <footer className="relative border-t border-foreground/10">
      <div className="absolute inset-0 h-64 opacity-20 pointer-events-none overflow-hidden">
        <AnimatedWave />
      </div>
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="py-16 lg:py-24">
          <div className="grid grid-cols-2 md:grid-cols-7 gap-12 lg:gap-8">
            <div className="col-span-2">
              <a href="/" className="inline-flex items-center gap-2 mb-6">
                <Image src="/logo.png" alt={common.appName} width={30} height={30} className="object-contain" />
                <span className="text-2xl font-display">SmartJib</span>
              </a>
              <p className="text-muted-foreground leading-relaxed max-w-xs">{ft.tagline}</p>
              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                SmartJib is a <a href="/features/multi-currency-mad" className="underline hover:no-underline">budget tracker that supports MAD and dirham</a> with <a href="/features/no-bank-connection" className="underline hover:no-underline">no bank connection</a> and <a href="/budgeting-methods" className="underline hover:no-underline">4 budgeting methods</a>.
              </p>
            </div>

            {footerLinks.map(({ title, links }) => (
              <div key={title}>
                <h3 className="text-sm font-medium mb-6">{title}</h3>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={`${title}-${link.name}-${link.href}`}>
                      <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2">
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="py-8 border-t border-foreground/10 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{ft.copyright}</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <a href="/features" className="hover:text-foreground">Features</a>
            <a href="/budgeting-methods" className="hover:text-foreground">Budgeting Methods</a>
            <a href="/blog" className="hover:text-foreground">Budgeting Guides</a>
            <a href="/features/multi-currency-mad" className="hover:text-foreground">MAD Guide</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
