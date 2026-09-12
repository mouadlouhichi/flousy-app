/**
 * Server-render the food knowledge body for the audit fixture. This catches
 * missing localization keys and verifies that the safety-relevant signals are
 * actually visible, rather than existing only in the analysis JSON.
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';
import { formatMessage, getIntlLocale, type Language, type Messages } from '../../src/lib/i18n-core';
import { foodLabelGrade } from '../../src/lib/food-knowledge/grade';
import { analyzeFoodText } from '../../src/lib/food-knowledge/analyze';

const catalogs: Record<Language, Messages> = {
  en: en as Messages,
  fr: fr as Messages,
  ar: ar as Messages,
};
let current: Language = 'en';

const languageValue = () => ({
  language: current,
  setLanguage: () => {},
  messages: catalogs[current],
  t: (template: string, values?: Record<string, string | number>) =>
    formatMessage(template, values, getIntlLocale(current)),
  translate: (path: string) => path,
  isRTL: current === 'ar',
  intlLocale: getIntlLocale(current),
  localeNames: { en: 'English', fr: 'Français', ar: 'العربية' },
});

mock.module('@/lib/i18n-context', {
  namedExports: {
    useLanguage: languageValue,
    LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
  },
});

const analysis = analyzeFoodText(
  [
    'WHOLE GRAIN ROLLED OATS',
    'VEGETABLE OIL (PARTIALLY HYDROGENATED COTTONSEED AND/OR SOYBEAN OIL)',
    'ALMONDS',
    'DRIED UNSWEETENED COCONUT',
    'NONFAT MILK',
    'GLYCERIN',
  ].join(', '),
);

describe('FoodKnowledgeBody render smoke', () => {
  it('renders nuts, the hydrogenated-oil concern and E422 in every locale', async () => {
    const { FoodKnowledgeBody } = await import(
      '../../src/components/dashboard/courses/courses-food-panel'
    );

    for (const locale of ['en', 'fr', 'ar'] as Language[]) {
      current = locale;
      const messages = catalogs[locale].foodKnowledge;
      const html = renderToStaticMarkup(
        React.createElement(FoodKnowledgeBody, { analysis }),
      );

      assert.ok(html.includes(messages.allergenNuts), `${locale}: nut allergen missing`);
      assert.ok(
        html.includes(messages.concernPartiallyHydrogenatedOil),
        `${locale}: partially hydrogenated oil signal missing`,
      );
      assert.ok(
        html.includes(messages.concernPartiallyHydrogenatedOilNote),
        `${locale}: trans-fat explanation missing`,
      );
      assert.ok(html.includes('E422'), `${locale}: glycerin additive code missing`);
      assert.doesNotMatch(html, /undefined|concernPartiallyHydrogenatedOil/);
    }
  });

  it('renders the ranked grade drivers with localized titles and point costs', async () => {
    const { FoodKnowledgeBody } = await import(
      '../../src/components/dashboard/courses/courses-food-panel'
    );
    const penalized = analyzeFoodText(
      'Sugar, vegetable oil (partially hydrogenated), colorant E171, colorant E102, salt',
    );
    assert.ok(foodLabelGrade(penalized), 'fixture must produce a grade');
    for (const locale of ['en', 'fr', 'ar'] as Language[]) {
      current = locale;
      const messages = catalogs[locale].foodKnowledge;
      const html = renderToStaticMarkup(
        React.createElement(FoodKnowledgeBody, { analysis: penalized }),
      ).replace(/&#x27;/g, "'");
      assert.ok(html.includes(messages.gradeDriversTitle), `${locale}: grade drivers title missing`);
      assert.ok(html.includes('E171'), `${locale}: avoid additive must lead the drivers`);
      assert.ok(html.includes(messages.concernPartiallyHydrogenatedOil), `${locale}: high concern driver missing`);
      assert.ok(html.includes('+60'), `${locale}: avoid penalty missing`);
    }
  });

  it('leads with a Yuka-style risk ring like the INCI side', async () => {
    const { FoodKnowledgeBody } = await import(
      '../../src/components/dashboard/courses/courses-food-panel'
    );
    // The reported orange-juice label: fully recognized, only neutral E330.
    const juice = analyzeFoodText(
      'orange juice, water, sugar, acidifier: citric acid, vitamin c, natural flavour',
    );
    const grade = foodLabelGrade(juice);
    assert.deepEqual(grade, { score: 100, band: 'excellent' });
    for (const locale of ['en', 'fr', 'ar'] as Language[]) {
      current = locale;
      const messages = catalogs[locale].foodKnowledge;
      const glance = catalogs[locale].ingredientGlance;
      const html = renderToStaticMarkup(
        React.createElement(FoodKnowledgeBody, { analysis: juice }),
      ).replace(/&#x27;/g, "'");
      // Risk ring: 100 − 100 = 0, aria-labelled with the localized band.
      assert.ok(html.includes('role="img"'), `${locale}: ring missing`);
      assert.ok(
        html.includes(`aria-label="0/100 — ${glance.bandExcellent}`),
        `${locale}: ring risk label missing`,
      );
      assert.ok(html.includes(messages.riskTitle), `${locale}: risk title missing`);
      assert.ok(html.includes(messages.riskScale), `${locale}: risk scale caption missing`);
    }
  });

  it('renders the NOVA processing group as an attributed source value beside the grade', async () => {
    const { FoodKnowledgeBody, NOVA_LABEL_KEY } = await import(
      '../../src/components/dashboard/courses/courses-food-panel'
    );
    const juice = analyzeFoodText(
      'orange juice, water, sugar, acidifier: citric acid, vitamin c, natural flavour',
    );
    for (const locale of ['en', 'fr', 'ar'] as Language[]) {
      current = locale;
      const messages = catalogs[locale].foodKnowledge;
      for (const group of [1, 2, 3, 4] as const) {
        const html = renderToStaticMarkup(
          React.createElement(FoodKnowledgeBody, { analysis: juice, novaGroup: group }),
        );
        assert.ok(html.includes(messages.novaTitle), `${locale}/${group}: NOVA title missing`);
        assert.ok(
          html.includes(messages.novaGroupLabel.replace('{group}', String(group))),
          `${locale}/${group}: NOVA group chip missing`,
        );
        assert.ok(
          html.includes(messages[NOVA_LABEL_KEY[group] as keyof typeof messages] as string),
          `${locale}/${group}: NOVA group label missing`,
        );
        assert.ok(html.includes(messages.novaNote), `${locale}/${group}: NOVA attribution missing`);
      }
      // Without a NOVA value the section must not appear at all — an absent
      // classification is not the same as "unprocessed".
      const without = renderToStaticMarkup(
        React.createElement(FoodKnowledgeBody, { analysis: juice }),
      );
      assert.equal(without.includes(messages.novaTitle), false, `${locale}: NOVA section must stay hidden`);
    }
  });

  it('renders generic class wording as unresolved identity rather than a known additive', async () => {
    const { FoodKnowledgeBody } = await import(
      '../../src/components/dashboard/courses/courses-food-panel'
    );
    const genericClasses = analyzeFoodText(
      'Salt, flavor enhancers, protein, color, food acid',
    );

    assert.equal(genericClasses.recognized, 1);
    assert.equal(genericClasses.additives.length, 0);
    for (const locale of ['en', 'fr', 'ar'] as Language[]) {
      current = locale;
      const messages = catalogs[locale].foodKnowledge;
      const html = renderToStaticMarkup(
        React.createElement(FoodKnowledgeBody, { analysis: genericClasses }),
      );
      for (const copy of [
        messages.unspecifiedFlavourEnhancer,
        messages.unspecifiedProteinSource,
        messages.unspecifiedColour,
        messages.unspecifiedFoodAcid,
      ]) {
        assert.ok(html.includes(copy), `${locale}: unresolved class label missing`);
      }
      assert.ok(!html.includes(messages.ingredientUnknown));
    }
  });

  it('uses aggregate OFF allergen groups even without a text hit', async () => {
    const { FoodKnowledgeBody } = await import(
      '../../src/components/dashboard/courses/courses-food-panel'
    );
    current = 'en';
    const offOnly = analyzeFoodText('Salt', { offAllergenTags: ['en:nuts'] });
    assert.equal(offOnly.allergens.length, 0);
    assert.deepEqual(offOnly.allergenGroups, ['nuts']);
    const html = renderToStaticMarkup(
      React.createElement(FoodKnowledgeBody, { analysis: offOnly }),
    );
    assert.ok(html.includes(en.foodKnowledge.allergenNuts));
  });
});
