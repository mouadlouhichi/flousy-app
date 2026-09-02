/**
 * The canonical origin of this deployment.
 *
 * It used to be hard-coded to the production host, which meant every preview and
 * staging build told crawlers that `https://flousy.app/…` was the canonical
 * version of its own pages — handing the real site the ranking credit, and
 * pointing `rel="canonical"`, robots and the sitemap at a deployment the
 * visitor is not on. It now follows `NEXT_PUBLIC_SITE_URL` (set per environment
 * in hosting or CI) and falls back to production only when nothing is
 * configured. A value that is not a valid absolute http(s) origin is ignored
 * instead of being emitted into `rel="canonical"` verbatim.
 */
function resolveSiteUrl(): string {
  const fallback = 'https://flousy.app';
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  if (!configured) return fallback;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = 'SmartJib';

export const OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'SmartJib budget tracker for needs, wants, savings, and money places',
} as const;

export const SUPPORTED_CURRENCY_CODES = [
  'MAD',
  'EUR',
  'USD',
  'GBP',
  'CAD',
  'CHF',
  'AED',
  'SAR',
  'EGP',
  'TND',
  'DZD',
  'XOF',
] as const;

export const BUDGETING_STRATEGIES = [
  '50/30/20',
  'zero-based budgeting',
  'envelope budgeting',
  'pay-yourself-first',
] as const;

export const FLOUSY_FACTUAL_DESCRIPTION =
  'SmartJib is a private budget tracker that separates what money is for—needs, wants, and savings—from where money is held—bank, home, or wallet. It supports 12 currencies and 4 budgeting strategies: 50/30/20, zero-based budgeting, envelope budgeting, and pay-yourself-first. SmartJib does not connect to your bank; you enter transactions manually. Account data is cached locally and synced to Firebase when you sign in.';

export interface LandingFaq {
  question: string;
  answer: string;
  link?: {
    label: string;
    href: string;
  };
}

export const LANDING_FAQS: readonly LandingFaq[] = [
  {
    question: 'Is SmartJib free?',
    answer:
      'SmartJib’s core budget is free with no time limit. Eligible accounts can start one 90-day Pro trial without a card; it does not renew automatically, and billing is not currently enabled.',
  },
  {
    question: 'Does SmartJib connect to my bank?',
    answer:
      'No, SmartJib does not connect to your bank. You manually enter transactions for privacy and control.',
  },
  {
    question: 'What currencies does SmartJib support?',
    answer:
      'SmartJib supports 12 currencies: MAD, EUR, USD, GBP, CAD, CHF, AED, SAR, EGP, TND, DZD, and XOF.',
  },
  {
    question: 'Is my data private?',
    answer:
      'Yes. Account data is cached locally and synced to Firebase when you sign in. We do not use your financial data to build advertising profiles or sell it to third parties. See our Privacy Policy for details.',
    link: {
      label: 'Privacy Policy',
      href: '/privacy',
    },
  },
  {
    question: 'What budgeting methods does SmartJib support?',
    answer:
      'SmartJib supports 4 budgeting strategies: 50/30/20, zero-based budgeting, envelope budgeting, and pay-yourself-first.',
  },
  {
    question: 'Can I export my data?',
    answer: 'Yes. From Profile you can export CSV files or a complete, restorable JSON backup.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'You can permanently delete your account and its associated budgeting data from Profile. SmartJib reports any incomplete deletion step so you can retry.',
  },
] as const;
