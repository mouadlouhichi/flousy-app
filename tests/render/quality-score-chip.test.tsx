/**
 * Server-renders the course-line quality score chip (and its open popover) in
 * all three locales: catches missing i18n keys / bad hook usage, and pins the
 * visible "score/100" text, the rating label and the green/yellow/orange tier
 * breakdown inside the popover.
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';
import { formatMessage, getIntlLocale, type Language, type Messages } from '../../src/lib/i18n-core';
import type { SessionItemQuality } from '../../src/lib/store';

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
    LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
  },
});

const quality: SessionItemQuality = { score: 87, band: 'excellent', good: 12, caution: 2, concern: 1 };

// Markup probes as a plain boolean array (keeps the assertions tidy).
function probes(html: string, needles: string[]) {
  return needles.map((needle) => html.includes(needle));
}

describe('QualityScoreChip render smoke', () => {
  it('renders the score chip with its localized aria-label in all three locales', async () => {
    const { QualityScoreChip } = await import('../../src/components/ui/quality-score-chip');
    for (const locale of ['en', 'fr', 'ar'] as Language[]) {
      current = locale;
      const html = renderToStaticMarkup(React.createElement(QualityScoreChip, { quality }));
      const [hasScore, hasBandLabel] = probes(html, [
        '87/100',
        (catalogs[current] as unknown as Record<string, Record<string, string>>).ingredientGlance.bandExcellent,
      ]);
      assert.ok(hasScore, `${locale}: score/100 missing`);
      assert.ok(hasBandLabel, `${locale}: band label missing from chip label`);
    }
  });

  it('chip starts closed; the popover carries the rating + 3-colour breakdown', async () => {
    const { QualityScoreChip, QualityScorePopover } = await import(
      '../../src/components/ui/quality-score-chip'
    );
    current = 'en';
    const closed = renderToStaticMarkup(React.createElement(QualityScoreChip, { quality }));
    const [startsClosed, isButton, hasDialog] = probes(closed, [
      'aria-expanded="false"',
      '<button',
      'role="dialog"',
    ]);
    assert.ok(startsClosed, 'chip should start closed');
    assert.ok(isButton, 'chip should be a button');
    assert.equal(hasDialog, false, 'popover must not render while closed');

    const popover = renderToStaticMarkup(
      React.createElement(QualityScorePopover, {
        quality,
        chipLabel: 'Excellent — 87/100',
      }),
    );
    const [hasDialogRole, hasRating, hasScore, hasClean, hasWatch, hasCaution, hasCount, hasGreen, hasYellow, hasOrange] =
      probes(popover, [
        'role="dialog"',
        'Excellent',
        '87/100',
        'Clean',
        'Watch',
        'Caution',
        '12',
        '#10b981',
        '#f59e0b',
        '#f97316',
      ]);
    assert.ok(hasDialogRole, 'popover dialog missing');
    assert.ok(hasRating, 'rating label missing');
    assert.ok(hasScore, 'score missing');
    // Green / yellow / orange tier breakdown rows (clean, watch, caution).
    assert.ok(hasClean, 'clean tier row missing');
    assert.ok(hasWatch, 'watch tier row missing');
    assert.ok(hasCaution, 'caution tier row missing');
    assert.ok(hasCount, 'clean count missing');
    assert.ok(hasGreen, 'green dot colour missing');
    assert.ok(hasYellow, 'yellow dot colour missing');
    assert.ok(hasOrange, 'orange dot colour missing');
  });
});
