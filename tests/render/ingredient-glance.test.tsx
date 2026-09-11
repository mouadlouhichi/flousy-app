/**
 * Server-renders the cosmetic ingredient glance (the scan-flow slice) with a
 * stubbed analysis client, in all three locales. Catches runtime crashes —
 * missing i18n keys, undefined access, bad hook usage — plus verifies that the
 * localized evidence-index caveat and value actually make it into the markup.
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
  total: 3,
  recognized: 3,
  localRecognized: 3,
  externallyIdentified: 0,
  coverage: 1,
  assessed: 3,
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
    {
      index: 1,
      raw: 'Hydroquinone',
      normalized: 'HYDROQUINONE',
      matched: true,
      matchedInci: 'HYDROQUINONE',
      identity: { status: 'official-glossary', canonicalName: 'HYDROQUINONE' },
      signals: [{ code: 'cosing-annex-II', kind: 'regulatory', label: '', detail: '', tier: 'prohibited', evidence: [] }],
      tier: 'prohibited',
      deduction: 100,
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
      deduction: 17,
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
      deduction: 14,
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
    // Mirrors the real module's public surface so the component under test
    // imports exactly what production imports.
    IngredientAnalysisError: class IngredientAnalysisError extends Error {
      readonly kind: string;
      constructor(kind: string, message: string) {
        super(message);
        this.name = 'IngredientAnalysisError';
        this.kind = kind;
      }
      get retryable(): boolean {
        return this.kind !== 'invalid';
      }
    },
    isOffline: () => false,
  },
});

mock.module('@/components/dashboard/dashboard-provider', {
  namedExports: {
    useDashboard: () => ({ user: null }),
  },
});

describe('CoursesIngredientGlance render smoke', () => {
  it('renders the bounded evidence index, caveat, and flags in all three locales', async () => {
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
      assert.ok(html.includes('20'), `${locale}: evidence index missing`);
      assert.ok(html.includes(catalogs[locale].ingredientGlance.evidenceIndex), `${locale}: evidence-index label missing`);
      assert.ok(html.includes(catalogs[locale].ingredientGlance.indexNotSafetyVerdict), `${locale}: safety caveat missing`);
      assert.equal(html.includes(catalogs[locale].ingredientGlance.bandAvoid), false, `${locale}: band must not be presented as a product verdict`);
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
    const hasBannerLabel = html.includes(`aria-label="${en.ingredientGlance.evidenceIndex}: 80/100"`);
    const hasScoreSuffix = html.includes('/100');
    assert.ok(hasBannerRole, 'banner missing its role');
    assert.ok(hasBannerLabel, 'banner aria-label missing');
    assert.ok(hasScoreSuffix, '/100 suffix missing');
    assert.ok(!html.includes('polygon points="12 2'), 'safety-rating stars must not be rendered');
    // All fixture rows carry explicit caution/prohibited evidence. No
    // identity-only ingredient is converted into a positive green verdict.
    assert.ok(html.includes('width:100%'), 'explicit concern segment missing');
    assert.equal(html.includes('width:25%'), false, 'unsupported positive segment must not appear');
  });

  it('renders the ranked risk drivers with localized title and point costs', async () => {
    const { CoursesIngredientGlanceBody } = await import(
      '../../src/components/dashboard/courses/courses-ingredient-glance'
    );
    for (const locale of ['en', 'fr', 'ar'] as Language[]) {
      current = locale;
      const html = renderToStaticMarkup(
        React.createElement(CoursesIngredientGlanceBody, { analysis }),
      );
      assert.ok(html.includes(catalogs[locale].ingredientGlance.riskDriversTitle), `${locale}: drivers title missing`);
      // Strongest driver first, with its localized point cost.
      const first = html.indexOf('HYDROQUINONE');
      assert.ok(first >= 0, `${locale}: top driver name missing`);
      const perfumeIndex = html.indexOf('PARFUM', first);
      assert.ok(perfumeIndex > first, `${locale}: drivers must be ordered strongest first`);
      assert.ok(html.includes('+100'), `${locale}: driver risk cost missing`);
      const g = catalogs[locale].ingredientGlance as unknown as Record<string, string>;
      const driverPoints = g.driverPoints.replace('{points}', '100');
      assert.ok(html.includes(driverPoints), `${locale}: localized point label missing`);
    }
  });

  it('renders the per-ingredient detail with identity, conditions and sources', async () => {
    const { IngredientDetail } = await import(
      '../../src/components/dashboard/courses/courses-ingredient-glance'
    );
    const detail = {
      index: 1,
      raw: 'Methylisothiazolinone',
      normalized: 'METHYLISOTHIAZOLINONE',
      matched: true,
      matchedInci: 'METHYLISOTHIAZOLINONE',
      cas: '2682-20-4',
      functions: ['PRESERVATIVE'],
      identity: { status: 'official-glossary' as const, canonicalName: 'METHYLISOTHIAZOLINONE', entry: '1234' },
      signals: [
        {
          code: 'eu-annex-v-57',
          kind: 'regulatory' as const,
          label: 'EU positive-list entry that does not cover the selected product form',
          detail: 'Rinse-off only, 0.0015%.',
          tier: 'restricted' as const,
          applicability: 'applies' as const,
          evidence: ['Regulation (EC) No 1223/2009 Annex V entry 57'],
          regulatory: {
            jurisdiction: 'EU' as const,
            framework: 'Regulation (EC) No 1223/2009' as const,
            annex: 'V' as const,
            entry: '57',
            legalRole: 'positive-list-with-conditions' as const,
            applicability: 'applies' as const,
            applicabilityReason: 'rinse-off only',
            maxConcentration: '0,0015 %',
            warnings: 'Not to be used in leave-on preparations',
            effectiveAsOf: '2026-05-26',
            sourceUpdated: '2026-05-26',
            sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2009/1223/2026-05-18/eng',
          },
        },
      ],
      tier: 'restricted' as const,
      assessmentState: 'assessed-signal' as const,
    };
    for (const locale of ['en', 'fr', 'ar'] as Language[]) {
      current = locale;
      const g = catalogs[locale].ingredientGlance;
      const html = renderToStaticMarkup(
        React.createElement(IngredientDetail, {
          ingredient: detail,
          g,
          t: languageValue().t,
        }),
      );
      assert.ok(html.includes('METHYLISOTHIAZOLINONE'), `${locale}: canonical name missing`);
      assert.ok(html.includes('2682-20-4'), `${locale}: CAS missing`);
      assert.ok(html.includes('PRESERVATIVE'), `${locale}: function missing`);
      assert.ok(html.includes('0,0015 %'), `${locale}: max concentration missing`);
      assert.ok(html.includes(g.detailAnnexEntry.replace('{annex}', 'V').replace('{entry}', '57')),
        `${locale}: annex entry label missing`);
      assert.ok(html.includes('Regulation (EC) No 1223/2009 Annex V entry 57'), `${locale}: source missing`);
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
