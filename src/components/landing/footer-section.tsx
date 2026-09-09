"use client";

import { useLightLanguage } from "@/lib/i18n-light";
import { AnimatedWave } from "./animated-wave";

export function FooterSection() {
  const { messages: { common, landing: { footer: ft } }, language } = useLightLanguage();
  const isRTL = language === 'ar';

  // Use translated footer keys with fallback to English
  const t = (key: string, fallback: string) => (ft as any)[key] || fallback;

  const footerLinks = [
    { title: t('product', 'Product'), links: [
      { name: t('featuresHub', 'Features Hub'), href: '/features' },
      { name: t('madGuide', 'Budget Tracker MAD & Dirham'), href: '/features/multi-currency-mad' },
      { name: t('bankWallet', 'Bank, Home, Wallet Tracking'), href: '/features/track-bank-home-wallet' },
      { name: t('noBank', 'No Bank Connection Privacy'), href: '/features/no-bank-connection' },
    ]},
    { title: t('budgetingMethodsTitle', 'Budgeting Methods') || 'Budgeting Methods', links: [
      { name: t('allMethods', 'All Methods Explained'), href: '/budgeting-methods' },
      { name: "50/30/20 Rule", href: '/budgeting-methods/50-30-20-rule' },
      { name: t('envelope', 'Envelope Budgeting'), href: '/budgeting-methods/envelope-budgeting' },
      { name: t('zeroBased', 'Zero-Based Budgeting'), href: '/budgeting-methods/zero-based-budgeting' },
    ]},
    { title: t('support', 'Support'), links: [
      { name: t('guidesTips', 'Budgeting Guides & Money Tips'), href: '/blog' },
      { name: t('purposeVsLocation', 'Why Purpose vs Location Matters'), href: '/blog/what-its-for-vs-where-it-is' },
      { name: t('helpCenter', 'Help center'), href: '/help' },
      { name: t('contactUs', 'Contact us'), href: '/contact' },
    ]},
    { title: t('company', 'Company'), links: [
      { name: t('about', 'About'), href: '/about' },
      { name: t('privateTracker', 'About Private Budget Tracker'), href: '/about' },
      { name: t('careers', 'Careers'), href: '/careers' },
      { name: t('freeMorocco', 'Free Budget Tracker Morocco'), href: '/' },
    ]},
    { title: t('legalCol', 'Legal'), links: [
      { name: t('privacyPolicy', 'Privacy policy'), href: '/privacy' },
      { name: t('termsOfService', 'Terms of service'), href: '/terms' },
      { name: t('cookiePolicy', 'Cookie policy'), href: '/cookies' },
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-128.png" alt={common.appName} width={30} height={30} className="object-contain" loading="lazy" />
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
            <a href="/features" className="hover:text-foreground">{t('features', 'Features')}</a>
            <a href="/budgeting-methods" className="hover:text-foreground">{t('budgetingMethodsTitle', 'Budgeting Methods') || 'Budgeting Methods'}</a>
            <a href="/blog" className="hover:text-foreground">{t('guidesTips', 'Budgeting Guides') || 'Guides'}</a>
            <a href="/features/multi-currency-mad" className="hover:text-foreground">{t('madGuide', 'MAD Guide')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
