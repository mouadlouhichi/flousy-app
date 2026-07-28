"use client";

import { ArrowUpRight } from "lucide-react";
import { useLightLanguage } from "@/lib/i18n-light";
import { AnimatedWave } from "./animated-wave";

const socialLinks = [
  { name: "Instagram", href: "#" },
  { name: "Twitter", href: "#" },
  { name: "LinkedIn", href: "#" },
];

export function FooterSection() {
  const { messages: { landing: { footer: ft } } } = useLightLanguage();

  const footerLinks = [
    { title: ft.product || 'Product', links: [
      { name: ft.features || 'Features', href: '/#features' },
      { name: ft.howItWorks || 'How it works', href: '/#how-it-works' },
      { name: ft.pricing || 'Pricing', href: '/#pricing' },
      { name: ft.currencies || 'Currencies', href: '/#integrations' },
    ]},
    { title: ft.support || 'Support', links: [
      { name: ft.helpCenter || 'Help center', href: '/help' },
      { name: ft.contactUs || 'Contact us', href: '/contact' },
      { name: ft.security || 'Security', href: '/#security' },
    ]},
    { title: ft.company || 'Company', links: [
      { name: ft.about || 'About', href: '/about' },
      { name: ft.careers || 'Careers', href: '/careers', badge: ft.hiring || 'Hiring' },
      { name: ft.blog || 'Blog', href: '/blog' },
    ]},
    { title: ft.legalCol || 'Legal', links: [
      { name: ft.privacyPolicy || 'Privacy policy', href: '/privacy' },
      { name: ft.termsOfService || 'Terms of service', href: '/terms' },
      { name: ft.cookiePolicy || 'Cookie policy', href: '/cookies' },
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
                <span className="text-2xl font-display">Flousy</span>
              </a>

              <p className="text-muted-foreground leading-relaxed mb-8 max-w-xs">
                {ft.tagline}
              </p>

              {/* Social Links */}
              <div className="flex gap-6">
                {socialLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
                  >
                    {link.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </a>
                ))}
              </div>
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
                        {"badge" in link && link.badge && (
                          <span className="text-xs px-2 py-0.5 bg-foreground text-background rounded-full">
                            {link.badge}
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-8 border-t border-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {ft.copyright}
          </p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {ft.allSystems}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
