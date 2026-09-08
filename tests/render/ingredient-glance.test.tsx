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
  formSource: 'explicit',
  total: 4,
  recognized: 4,
  localRecognized: 4,
  externallyIdentified: 0,
  coverage: 1,
  assessed: 4,
  assessmentCoverage: 1,
  score: 20,
  scoreStatus: 'available',
  confidence: 'full',
  band: 'avoid',
  worstTier: 'prohibited',
  unknownIngredients: [],
  cappedReason: 'prohibited-ingredient',
  parser: { valid: true, reviewed: true, source: 'typed', diagnostics: [] },
  dataset: { rows: 28733, snapshot: 'test snapshot', version: 'test' },
  assessedAt: '2026-09-08T00:00:00.000Z',
  ingredients: [
    { index: 0, raw: 'Aqua', normalized: 'AQUA', matched: true, matchedInci: 'AQUA', identity: { status: 'official-glossary', canonicalName: 'AQUA' }, signals: [], tier: 'clean', assessmentState: 'assessed-signal' },
    {
      index: 1,
      raw: 'Hydroquinone',
      normalized: 'HYDROQUINONE',
      matched: true,
      matchedInci: 'HYDROQUINONE',
      identity: { status: 'official-glossary', canonicalName: 'HYDROQUINONE' },
      signals: [{ code: 'cosing-annex-II', kind: 'regulatory', label: '', detail: '', tier: 'prohibited', evidence: [] }],
      tier: 'prohibited',
      assessmentState: 'assessed-signal',
    },
    {
      index: 2,
      raw: 'Parfum',
      normalized: 'PARFUM',
      matched: true,
      matchedInci: 'PARFUM',
      identity: { status: 'official-glossary', canonicalName: 'PARFUM' },
      signals: [{ code: 'fragrance-generic', kind: 'comfort', label: '', detail: '', tier: 'caution', evidence: [] }],
      tier: 'caution',
      assessmentState: 'assessed-signal',
    },
    {
      index: 3,
      raw: 'Linalool',
      normalized: 'LINALOOL',
      matched: true,
      matchedInci: 'LINALOOL',
      identity: { status: 'official-glossary', canonicalName: 'LINALOOL' },
      signals: [{ code: 'eu-fragrance-allergen', kind: 'regulatory', label: '', detail: '', tier: 'caution', evidence: [] }],
      tier: 'caution',
      assessmentState: 'assessed-signal',
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

  it('renders the evidence-index banner without a safety-rating star metaphor', async () => {
    const { CoursesIngredientGlanceBody } = await import(
      '../../src/components/dashboard/courses/courses-ingredient-glance'
    );
    current = 'en';
    const html = renderToStaticMarkup(
      React.createElement(CoursesIngredientGlanceBody, { analysis }),
    );
    const hasBannerRole = html.includes('role="img"');
    const hasBannerLabel = html.includes(`aria-label="${en.ingredientGlance.evidenceIndex}: 20/100"`);
    const hasScoreSuffix = html.includes('/100');
    assert.ok(hasBannerRole, 'banner missing its role');
    assert.ok(hasBannerLabel, 'banner aria-label missing');
    assert.ok(hasScoreSuffix, '/100 suffix missing');
    assert.ok(!html.includes('polygon points="12 2'), 'safety-rating stars must not be rendered');
    // Thin tier-proportion strip under the score:
    // fixture tiers = clean 1 / (watch+restricted 0) / (caution+prohibited 3) of 4.
    const hasGreenSegment = html.includes('width:25%');
    const hasOrangeSegment = html.includes('width:75%');
    assert.ok(hasGreenSegment, 'green tier segment missing');
    assert.ok(hasOrangeSegment, 'orange tier segment missing');
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

describe('CoursesIngredientPanel render smoke', () => {
  it('offers the manual paste fallback when no source had an INCI list', async () => {
    const { CoursesIngredientPanel } = await import(
      '../../src/components/dashboard/courses/courses-ingredient-panel'
    );
    for (const locale of ['en', 'fr', 'ar'] as Language[]) {
      current = locale;
      const g = catalogs[locale];
      const html = renderToStaticMarkup(
        React.createElement(CoursesIngredientPanel, {
          barcode: '6111234567895',
          name: 'Crème inconnue',
          category: 'Face creams',
        }),
      );
      // This React/SSR version emits apostrophes as `\&#x27;` (a literal
      // backslash + entity) — strip the backslash and decode before comparing.
      const decoded = html.replace(/\\/g, '').replace(/&#x27;|&#39;|&apos;/g, "'");
      assert.ok(
        decoded.includes(g.ingredientManual.missingHint),
        `${locale}: manual fallback hint missing`,
      );
      assert.ok(decoded.includes(g.ingredientManual.pasteCta), `${locale}: paste CTA missing`);
    }
  });

  it('auto-analyzes when the record carried an INCI list (title + fetching state)', async () => {
    const { CoursesIngredientPanel } = await import(
      '../../src/components/dashboard/courses/courses-ingredient-panel'
    );
    current = 'en';
    const g = catalogs[current];
    const html = renderToStaticMarkup(
      React.createElement(CoursesIngredientPanel, {
        barcode: '6111234567895',
        initialText: 'Aqua, Glycerin, Niacinamide, Parfum',
        name: 'Crème',
        category: 'Face creams',
      }),
    );
    assert.ok(html.includes(g.ingredientGlance.title), 'glance title missing');
    assert.ok(html.includes(g.ingredientGlance.analyzing), 'fetching state missing');
    assert.ok(html.includes(g.ingredientManual.editIngredients), 'edit action missing');
  });
});
