import type { ReactNode } from 'react';
import { staticPageMetadata } from '@/lib/page-meta';
import { SITE_URL } from '@/lib/seo';

export const metadata = staticPageMetadata(
  'features/multi-currency-mad',
  'Budget Tracker MAD & Dirham — Multi-Currency Support | SmartJib Morocco',
  'Track your budget in MAD, dirham, EUR, USD and 12 currencies. SmartJib supports Moroccan dirham with locale formatting, offline cache, and no bank connection.',
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: 'Features', item: `${SITE_URL}/features` },
              { '@type': 'ListItem', position: 3, name: 'MAD & Multi-Currency', item: `${SITE_URL}/features/multi-currency-mad` },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              { '@type': 'Question', name: 'Does SmartJib support MAD and Moroccan dirham?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, SmartJib supports MAD as primary currency with locale formatting, plus 11 others: EUR, USD, GBP, CAD, CHF, AED, SAR, EGP, TND, DZD, XOF.' } },
              { '@type': 'Question', name: 'Can I change currency after starting?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, change display currency from Profile → Preferences. Historical months keep their saved currency to avoid confusion.' } },
            ],
          }),
        }}
      />
      {children}
    </>
  );
}
