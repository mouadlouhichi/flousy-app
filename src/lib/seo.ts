export const SITE_URL = 'https://flousy.app';

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
      'SmartJib has a free plan for core budgeting. SmartJib Pro is an optional paid upgrade.',
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
    answer: 'Yes. You can export your budgeting data as a CSV file from Settings.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'You can permanently delete your account and its associated budgeting data from Settings.',
  },
] as const;
