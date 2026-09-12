/**
 * Server-renders the mobile quick-access row in all three locales. Catches
 * missing i18n keys / bad hook usage and pins the plan-aware behaviour:
 * Pro users get the knowledge / analytics / Darat chips, free users get no
 * row at all (every destination it can list is Pro-gated).
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';
import { formatMessage, getIntlLocale, type Language, type Messages } from '../../src/lib/i18n-core';

const catalogs: Record<Language, Messages> = { en: en as Messages, fr: fr as Messages, ar: ar as Messages };
let current: Language = 'en';

mock.module('@/lib/i18n-context', {
  namedExports: {
    useLanguage: () => ({
      language: current,
      setLanguage: () => {},
      messages: catalogs[current],
      t: (tpl: string, v?: Record<string, string | number>) => formatMessage(tpl, v, getIntlLocale(current)),
      translate: (p: string) => p,
      isRTL: current === 'ar',
      intlLocale: getIntlLocale(current),
      localeNames: { en: 'English', fr: 'Français', ar: 'العربية' },
    }),
  },
});
mock.module('next/navigation', {
  namedExports: { useRouter: () => ({ push: () => {} }) },
});

describe('render: mobile quick access row', async () => {
  for (const lang of ['en', 'fr', 'ar'] as Language[]) {
    describe(lang, () => {
      it('lists knowledge, analytics and Darat for Pro users', async () => {
        current = lang;
        // Dynamic import: the mocks above must be registered before the
        // component (and its i18n-context import) is evaluated.
        const { QuickAccessRow } = await import('../../src/components/dashboard/quick-access-row');
        const html = renderToStaticMarkup(<QuickAccessRow isPro />);
        const m = catalogs[lang].navigation;
        assert.ok(html.includes(m.quickAccess), 'missing the quick-access aria-label');
        assert.ok(html.includes(m.knowledge), 'missing the knowledge chip');
        assert.ok(html.includes(m.trends), 'missing the analytics chip');
        assert.ok(html.includes(m.darat), 'missing the Darat chip');
      });

      it('renders no row for free users', async () => {
        current = lang;
        const { QuickAccessRow } = await import('../../src/components/dashboard/quick-access-row');
        assert.equal(renderToStaticMarkup(<QuickAccessRow isPro={false} />), '');
      });
    });
  }
});
