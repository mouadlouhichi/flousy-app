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
import { TestimonialsSection } from '@/components/landing/testimonials-section';
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

const title = 'Flousy - Free Private Budgeting & Money Tracker App';
const description =
  'Track money in bank, home, and wallet for free. Start budgeting with Flousy, the private budget tracker supporting MAD, dirham, and 12 currencies with 4 budgeting styles.';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
    languages: {
      'en': '/en',
      'fr': '/fr',
      'ar': '/ar',
    },
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
  offers: {
    '@type': 'Offer',
    name: 'Flousy Free',
    price: '0',
    priceCurrency: 'USD',
  },
  description: FLOUSY_FACTUAL_DESCRIPTION,
  url: SITE_URL,
  image: `${SITE_URL}${OG_IMAGE.url}`,
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
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

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: SITE_NAME,
  image: `${SITE_URL}/icon.png`,
  url: SITE_URL,
  telephone: '+1-555-123-4567',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '123 Budget St',
    addressLocality: 'Finance City',
    addressRegion: 'FC',
    postalCode: '12345',
    addressCountry: 'US'
  }
};

export default function Home() {
  return (
    <>
      <JsonLd id="software-application-json-ld" data={softwareApplicationSchema} />
      <JsonLd id="organization-json-ld" data={organizationSchema} />
      <JsonLd id="local-business-json-ld" data={localBusinessSchema} />
      <JsonLd id="faq-json-ld" data={faqSchema} />

      <main className="noise-overlay relative min-h-screen overflow-x-hidden">
        <Navigation />
        <HeroSection />
        <WhatIsFlousySection />
        <FeaturesSection />
        <HowItWorksSection />
        <InfrastructureSection />
        <MetricsSection />
        <IntegrationsSection />
        <SecuritySection />
        <TestimonialsSection />
        <PricingSection />
        <FaqSection />
        <CtaSection />
        <FooterSection />
      </main>
    </>
  );
}
