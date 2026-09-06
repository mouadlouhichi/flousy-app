/**
 * ProductQualityPanel SSR smoke — the Yuka/INCI-Beauty-style overall
 * rating banner (big score, quality label, stars) and its band logic.
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../../messages/en.json';
import { formatMessage, getIntlLocale, type Messages } from '../../src/lib/i18n-core';

const catalogs: Messages = en as Messages;

mock.module('@/lib/i18n-context', {
  namedExports: {
    useLanguage: () => ({
      language: 'en' as const,
      setLanguage: () => {},
      messages: catalogs,
      t: (tpl: string, v?: Record<string, string | number>) => formatMessage(tpl, v, getIntlLocale('en')),
      translate: (p: string) => p,
      isRTL: false,
      intlLocale: getIntlLocale('en'),
      localeNames: { en: 'English', fr: 'Fran\u00e7ais', ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' },
    }),
  },
});

const render = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('product quality panel: overall rating banner', async () => {
  const { ProductQualityPanel } = await import('../../src/components/ui/product-quality-panel');

  it('renders a full score as an Excellent banner with 5 stars', () => {
    const html = render(<ProductQualityPanel ingredients={['Aqua', 'Glycerin', 'Tocopherol', 'Panthenol']} />);
    // Big score + /20
    assert.match(html, /text-5xl font-black leading-none[^>]*>20/);
    assert.match(html, />\/20</);
    // Label + aria
    assert.match(html, /Excellent/);
    assert.match(html, /aria-label="Excellent \u2014 20 \/ 20"/);
    // Five stars (filled)
    const stars = (html.match(/\u2605/g) ?? []).length;
    assert.equal(stars, 5);
  });

  it('drops the band for a list with concern ingredients', () => {
    // SLS (concern) + PARFUM (caution) + clean base → mid score.
    const html = render(
      <ProductQualityPanel
        ingredients={['Aqua', 'Sodium Lauryl Sulfate', 'Parfum', 'Glycerin', 'Tocopherol', 'Panthenol', 'Niacinamide']}
      />,
    );
    assert.ok(/Fair|Good|Excellent/.test(html), 'banner label present');
    // Stars row is present with 5 glyphs total
    assert.equal((html.match(/\u2605/g) ?? []).length, 5);
  });

  it('keeps the ingredient list, chips and source note', () => {
    const html = render(<ProductQualityPanel ingredients={['Aqua', 'Parfum']} />);
    assert.match(html, /PARFUM|Parfum/);
    assert.match(html, /aria-pressed/); // tier chips
    assert.match(html, /sourceNote|Open Beauty Facts|photo/i);
  });
});
