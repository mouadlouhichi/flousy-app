import type { Metadata } from 'next';
import { Navigation } from '@/components/landing/navigation';
import { HeroSection } from '@/components/landing/hero-section';
import { WhatIsFlousySection } from '@/components/landing/what-is-flousy-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
import { InfrastructureSection } from '@/components/landing/infrastructure-section';
import { MetricsSection } from '@/components/landing/metrics-section';
import { IntegrationsSection } from '@/components/landing/integrations-section';
import { SecuritySection } from '@/components/landing/security-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { FaqSection } from '@/components/landing/faq-section';
import { CtaSection } from '@/components/landing/cta-section';
import { FooterSection } from '@/components/landing/footer-section';
import { JsonLd } from '@/components/seo/json-ld';
import {
  FLOUSY_FACTUAL_DESCRIPTION,
  LANDING_FAQS,
  OG_IMAGE,
  SITE_NAME,
  SITE_URL,
} from '@/lib/seo';

const title = 'SmartJib - Free Private Budgeting & Money Tracker App';
const description =
  'Track money in bank, home, and wallet for free. Start budgeting with SmartJib, the private budget tracker supporting MAD, dirham, and 12 currencies with 4 budgeting styles.';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    // Self-referential canonical only. There is a single URL per page — the UI
    // language is a client preference, not a locale path — so declaring
    // `/en`, `/fr` and `/ar` alternates promised crawlers three localized
    // versions that return 404. hreflang entries for missing URLs cost crawl
    // budget and can get the whole cluster ignored; the localized titles are
    // applied after hydration by <LocalizedDocumentTitle/>.
    canonical: '/',
  },
  openGraph: {
    title,
    description,
    url: '/',
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [OG_IMAGE.url],
  },
};

const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web, iOS (PWA), Android (PWA)',
  offers: [
    {
      '@type': 'Offer',
      name: 'SmartJib Free',
      price: '0',
      priceCurrency: 'MAD',
      availability: 'https://schema.org/InStock',
      description: 'Core budgeting with no time limit.',
    },
    {
      '@type': 'Offer',
      name: 'SmartJib Pro 90-day launch trial',
      price: '0',
      priceCurrency: 'MAD',
      availability: 'https://schema.org/InStock',
      description: 'One no-card 90-day trial. It does not renew and billing is not enabled.',
    },
  ],
  isAccessibleForFree: true,
  description: FLOUSY_FACTUAL_DESCRIPTION,
  url: SITE_URL,
  image: `${SITE_URL}${OG_IMAGE.url}`,
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  alternateName: 'Flousy',
  url: SITE_URL,
  logo: `${SITE_URL}/web-app-manifest-512x512.png`,
  email: 'hello@flousy.app',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'hello@flousy.app',
    availableLanguage: ['English', 'French', 'Arabic'],
  },
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: 'Flousy',
  url: SITE_URL,
  inLanguage: ['en', 'fr', 'ar'],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: LANDING_FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

export default function Home() {
  return (
    <>
      <JsonLd id="software-application-json-ld" data={softwareApplicationSchema} />
      <JsonLd id="organization-json-ld" data={organizationSchema} />
      <JsonLd id="website-json-ld" data={websiteSchema} />
      <JsonLd id="faq-json-ld" data={faqSchema} />

      <main id="main-content" className="noise-overlay relative min-h-screen overflow-x-hidden">
        <Navigation />
        <HeroSection />
        <WhatIsFlousySection />
        <FeaturesSection />
        <HowItWorksSection />
        <InfrastructureSection />
        <MetricsSection />
        <IntegrationsSection />
        <SecuritySection />
        <PricingSection />
        <FaqSection />
        <CtaSection />
        <FooterSection />
      </main>
    </>
  );
}
