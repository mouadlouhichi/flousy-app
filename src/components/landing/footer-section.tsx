"use client";

import { ArrowUpRight } from "lucide-react";
import { useLightLanguage } from "@/lib/i18n-light";
import { AnimatedWave } from "./animated-wave";

const footerLinks = {
  Product: [
    { name: "Features", href: "/#features" },
    { name: "How it works", href: "/#how-it-works" },
    { name: "Pricing", href: "/#pricing" },
    { name: "Currencies", href: "/#integrations" },
  ],
  Support: [
    { name: "Help center", href: "/help" },
    { name: "Contact us", href: "/contact" },
    { name: "Security", href: "/#security" },
  ],
  Company: [
    { name: "About", href: "/about" },
    { name: "Careers", href: "/careers", badge: "Hiring" },
    { name: "Blog", href: "/blog" },
  ],
  Legal: [
    { name: "Privacy policy", href: "/privacy" },
    { name: "Terms of service", href: "/terms" },
    { name: "Cookie policy", href: "/cookies" },
  ],
};

const socialLinks = [
  { name: "Facebook", href: "https://facebook.com/flousyapp" },
  { name: "Twitter", href: "https://twitter.com/flousyapp" },
  { name: "Instagram", href: "https://instagram.com/flousyapp" },
  { name: "LinkedIn", href: "https://linkedin.com/company/flousy" },
  { name: "YouTube", href: "https://youtube.com/@flousyapp" },
];

export function FooterSection() {
  const { messages: { landing: { footer: ft } } } = useLightLanguage();
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

              <p className="text-muted-foreground leading-relaxed mb-6 max-w-xs">
                {ft.tagline}
              </p>

              {/* Contact Info for Local SEO */}
              <address className="text-sm text-muted-foreground mb-8 not-italic">
                <p>123 Budget St, Finance City, FC 12345</p>
                <p><a href="tel:+15551234567" className="hover:text-foreground">+1 (555) 123-4567</a></p>
              </address>

              {/* Social Links */}
              <div className="flex flex-wrap gap-4">
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
            {Object.entries(footerLinks).map(([title, links]) => (
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
