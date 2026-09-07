/**
 * Server-renders the cosmetic ingredient glance (the scan-flow slice) with a
 * stubbed analysis client, in all three locales. Catches runtime crashes —
 * missing i18n keys, undefined access, bad hook usage — plus verifies that the
 * localized band label and score chip actually make it into the markup.
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';
import { formatMessage, getIntlLocale, type Language, type Messages } from '../../src/lib/i18n-core';
import type { ProductAssessment } from '../../src/lib/ingredient-safety/types';

const catalogs: Record<Language, Messages> = { en: en as Messages, fr: fr as Messages, ar: ar as Messages };
let current: Language = 'en';

const languageValue = () => ({
  language: current,
  setLanguage: () => {},
  messages: catalogs[current],
  t: (tpl: string, v?: Record<string, string | number>) => formatMessage(tpl, v, getIntlLocale(current)),
  translate: (p: string) => p,
  isRTL: current === 'ar',
  intlLocale: getIntlLocale(current),
  localeNames: { en: 'English', fr: 'Français', ar: 'العربية' },
});

mock.module('@/lib/i18n-context', {
  namedExports: { useLanguage: languageValue, LanguageProvider: ({ children }: { children: React.ReactNode }) => children },
});

// Canned analysis: hydroquinone cream with parfum + a fragrance allergen —
// exercises the error flag, allergen count, generic fragrance and the
// per-ingredient tier list, plus the "avoid" band chip.
const analysis: ProductAssessment = {
  label: 'Test cream',
  form: 'leave-on',
  total: 4,
  recognized: 4,
  coverage: 1,
  score: 20,
  confidence: 'full',
  band: 'avoid',
  worstTier: 'prohibited',
  unknownIngredients: [],
  cappedReason: 'prohibited-ingredient',
  dataset: { rows: 28733, snapshot: 'test snapshot', version: 'test' },
  ingredients: [
    { index: 0, raw: 'Aqua', normalized: 'AQUA', matched: true, matchedInci: 'AQUA', signals: [], tier: 'clean' },
    {
      index: 1,
      raw: 'Hydroquinone',
      normalized: 'HYDROQUINONE',
      matched: true,
      matchedInci: 'HYDROQUINONE',
      signals: [{ code: 'cosing-annex-II', label: '', detail: '', tier: 'prohibited', evidence: [] }],
      tier: 'prohibited',
    },
    {
      index: 2,
      raw: 'Parfum',
      normalized: 'PARFUM',
      matched: true,
      matchedInci: 'PARFUM',
      signals: [{ code: 'fragrance-generic', label: '', detail: '', tier: 'caution', evidence: [] }],
      tier: 'caution',
    },
    {
      index: 3,
      raw: 'Linalool',
      normalized: 'LINALOOL',
      matched: true,
      matchedInci: 'LINALOOL',
      signals: [{ code: 'eu-fragrance-allergen', label: '', detail: '', tier: 'caution', evidence: [] }],
      tier: 'caution',
    },
  ],
  flags: [
    { level: 'error', code: 'contains-prohibited', text: '' },
    { level: 'warn', code: 'fragrance-allergens', text: '' },
    { level: 'warn', code: 'fragrance-generic', text: '' },
  ],
};

mock.module('@/lib/ingredient-analysis-client', {
  namedExports: {
    analyzeIngredientsText: async () => analysis as unknown as ProductAssessment,
  },
});

const EXPECTED_BAND: Record<Language, string> = {
  en: (en.ingredientGlance.bandAvoid as string).toLowerCase(),
  fr: (fr.ingredientGlance.bandAvoid as string).toLowerCase(),
  ar: ar.ingredientGlance.bandAvoid as string,
};

describe('CoursesIngredientGlance render smoke', () => {
  it('renders score, translated band and flags in all three locales', async () => {
    // The async wrapper needs effects to fetch; the exported presentational
    // body is what renderToStaticMarkup can exercise directly.
    const { CoursesIngredientGlanceBody } = await import(
      '../../src/components/dashboard/courses/courses-ingredient-glance'
    );
    for (const locale of ['en', 'fr', 'ar'] as Language[]) {
      current = locale;
      const html = renderToStaticMarkup(
        React.createElement(CoursesIngredientGlanceBody, { analysis }),
      );
      assert.ok(html.includes('20'), `${locale}: score chip missing`);
      assert.ok(
        html.toLowerCase().includes(EXPECTED_BAND[locale]) ||
          html.includes(EXPECTED_BAND[locale]),
        `${locale}: translated band label missing`,
      );
      assert.ok(html.includes('HYDROQUINONE'), `${locale}: flagged ingredient name missing`);
      assert.ok(html.includes('disclaimer') === false, `${locale}: disclaimer key leaked raw`);
    }
  });

  it('renders nothing (not even an error) when no ingredient text is present', async () => {
    const { CoursesIngredientGlance } = await import(
      '../../src/components/dashboard/courses/courses-ingredient-glance'
    );
    current = 'en';
    const html = renderToStaticMarkup(
      React.createElement(CoursesIngredientGlance, { ingredientsText: '   ' }),
    );
    assert.equal(html, '');
  });
});
