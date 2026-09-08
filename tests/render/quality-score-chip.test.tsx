/**
 * Server-renders the course-line quality score chip (and its open popover) in
 * all three locales: catches missing i18n keys / bad hook usage, and pins the
 * visible "score/100" text, evidence-index caveat, and exact six-state
 * evidence breakdown inside the popover.
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

const quality: SessionItemQuality = {
  schemaVersion: 2,
  score: 87,
  scoreStatus: 'available',
  band: 'excellent',
  tiers: { prohibited: 0, restricted: 0, caution: 0, watch: 1, clean: 0, unassessed: 0 },
};

// Markup probes as a plain boolean array (keeps the assertions tidy).
function probes(html: string, needles: string[]) {
  return needles.map((needle) => html.includes(needle));
}

describe('QualityScoreChip render smoke', () => {
  it('renders the score chip with a localized evidence-index label in all three locales', async () => {
    const { QualityScoreChip } = await import('../../src/components/ui/quality-score-chip');
    for (const locale of ['en', 'fr', 'ar'] as Language[]) {
      current = locale;
      const html = renderToStaticMarkup(React.createElement(QualityScoreChip, { quality }));
      const [hasScore, hasEvidenceLabel] = probes(html, [
        '87/100',
        catalogs[current].ingredientGlance.evidenceIndex,
      ]);
      assert.ok(hasScore, `${locale}: score/100 missing`);
      assert.ok(hasEvidenceLabel, `${locale}: evidence-index label missing from chip label`);
      assert.equal(html.includes(catalogs[current].ingredientGlance.bandExcellent), false, `${locale}: band must not be presented as a product verdict`);
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

    const chipLabel = `${en.ingredientGlance.evidenceIndex} — 87/100`;
    const popover = renderToStaticMarkup(
      React.createElement(QualityScorePopover, { quality, chipLabel }),
    );
    const [
      hasDialogRole,
      hasEvidenceLabel,
      hasScore,
      hasNoSignalCaveat,
      hasWatch,
      hasCaution,
      hasRestricted,
      hasProhibited,
      hasIdentityOnly,
      hasWatchCount,
    ] = probes(popover, [
      'role="dialog"',
      en.ingredientGlance.evidenceIndex,
      '87/100',
      en.ingredientGlance.bandClean,
      en.ingredientGlance.bandWatch,
      en.ingredientGlance.bandCaution,
      en.ingredientGlance.bandRestricted,
      en.ingredientGlance.bandProhibited,
      en.ingredientGlance.identityOnly,
      '>1</span>',
    ]);
    assert.ok(hasDialogRole, 'popover dialog missing');
    assert.ok(hasEvidenceLabel, 'evidence-index label missing');
    assert.ok(hasScore, 'score missing');
    assert.ok(hasNoSignalCaveat, 'no-listed-signal caveat missing');
    assert.ok(hasWatch, 'watch tier row missing');
    assert.ok(hasCaution, 'caution tier row missing');
    assert.ok(hasRestricted, 'restricted tier row missing');
    assert.ok(hasProhibited, 'prohibited tier row missing');
    assert.ok(hasIdentityOnly, 'identity-only row missing');
    assert.ok(hasWatchCount, 'watch count missing');
  });
});
