"use client";

import Image from "next/image";
import { useLightLanguage } from "@/lib/i18n-light";
import { AnimatedWave } from "./animated-wave";

export function FooterSection() {
  const { messages: { common, landing: { footer: ft } } } = useLightLanguage();

  const footerLinks = [
    { title: ft.product, links: [
      { name: ft.features, href: '/#features' },
      { name: ft.howItWorks, href: '/#how-it-works' },
      { name: ft.pricing, href: '/#pricing' },
      { name: ft.currencies, href: '/#integrations' },
    ]},
    { title: ft.support, links: [
      { name: ft.helpCenter, href: '/help' },
      { name: ft.contactUs, href: '/contact' },
      { name: ft.security, href: '/#security' },
    ]},
    { title: ft.company, links: [
      { name: ft.about, href: '/about' },
      { name: ft.careers, href: '/careers' },
      { name: ft.blog, href: '/blog' },
    ]},
    { title: ft.legalCol, links: [
      { name: ft.privacyPolicy, href: '/privacy' },
      { name: ft.termsOfService, href: '/terms' },
      { name: ft.cookiePolicy, href: '/cookies' },
    ]},
  ];
  return (
    <footer className="relative border-t border-foreground/10">
      {/* Animated wave background */}
      <div className="absolute inset-0 h-64 opacity-20 pointer-events-none overflow-hidden">
        <AnimatedWave />
      </div>
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Main Footer */}
        <div className="py-16 lg:py-24">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-12 lg:gap-8">
            {/* Brand Column */}
            <div className="col-span-2">
              <a href="/" className="inline-flex items-center gap-2 mb-6">
                <Image
                  src="/logo.png"
                  alt={common.appName}
                  width={30}
                  height={30}
                  className="object-contain"
                />
                <span className="text-2xl font-display">SmartJib</span>
              </a>

              <p className="text-muted-foreground leading-relaxed max-w-xs">
                {ft.tagline}
              </p>
            </div>

            {/* Link Columns */}
            {footerLinks.map(({ title, links }) => (
              <div key={title}>
                <h3 className="text-sm font-medium mb-6">{title}</h3>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-8 border-t border-foreground/10 flex items-center">
          <p className="text-sm text-muted-foreground">
            {ft.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
