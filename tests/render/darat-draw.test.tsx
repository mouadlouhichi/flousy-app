/**
 * Server-renders the post-create "Random draw" panel in all three locales.
 * Catches missing i18n keys / bad hook usage, and pins the pre-reveal
 * (rolling) state: the draw is revealed client-side once the dice settle,
 * so the SSR markup must show the rolling text and NOT the seat names —
 * the ordering stays hidden until the one-shot roll finishes.
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

const seats = ['u1', '+212 600-000000'];
const seatLabel = (id: string) => (id === 'u1' ? 'Alice' : 'Bob');

describe('render: darat create draw panel', async () => {
  for (const lang of ['en', 'fr', 'ar'] as Language[]) {
    describe(lang, () => {
      it('renders the rolling state and keeps the ordering hidden until the dice settle', async () => {
        current = lang;
        // Dynamic import: the mocks above must be registered before the
        // component (and its i18n-context import) is evaluated.
        const { DaratDrawPanel } = await import('../../src/components/dashboard/darat/darat-dice');
        const raw = renderToStaticMarkup(<DaratDrawPanel circleId="circle-abc123" seats={seats} seatLabel={seatLabel} />);
        // React escapes quotes in text nodes ("&#x27;", "&quot;") — undo
        // that so message strings with apostrophes match verbatim.
        const html = raw.replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
        const m = catalogs[lang].darat.create;
        assert.ok(html.includes(m.drawTitle), `missing drawTitle in ${lang}`);
        assert.ok(html.includes(m.drawHint), `missing drawHint in ${lang}`);
        assert.ok(html.includes(m.drawRolling), `missing drawRolling in ${lang}`);
        // SSR is the pre-settle state: no seat name may be revealed yet.
        assert.ok(!html.includes('Alice'), 'revealed seat rendered before the roll settled');
        assert.ok(!html.includes('Bob'), 'revealed seat rendered before the roll settled');
      });
    });
  }
});
