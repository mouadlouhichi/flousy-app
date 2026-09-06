/**
 * QualityScoreChip SSR smoke — the score chip shown after a course line's
 * name. The click popover is client-side (Radix), so static markup only
 * asserts the trigger (score, band styling, accessible label).
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

describe('quality score chip', async () => {
  const { QualityScoreChip } = await import('../../src/components/ui/quality-score-chip');

  it('renders the score with the rating label in the accessible label', () => {
    const html = render(
      <QualityScoreChip summary={{ score: 16.7, good: 12, caution: 3, concern: 1 }} />,
    );
    assert.match(html, />16.7<span class="opacity-60">\/20<\/span>/);
    assert.match(html, /aria-label="Excellent \u2014 16.7 \/ 20"/);
  });

  it('uses the poor band for a low score', () => {
    const html = render(
      <QualityScoreChip summary={{ score: 5, good: 1, caution: 2, concern: 8 }} />,
    );
    assert.match(html, /bg-error\/10 text-error/);
    assert.match(html, /aria-label="Poor \u2014 5 \/ 20"/);
  });

  it('uses whole-number formatting when the score has no fraction', () => {
    const html = render(
      <QualityScoreChip summary={{ score: 20, good: 4, caution: 0, concern: 0 }} />,
    );
    assert.match(html, />20<span class="opacity-60">\/20<\/span>/);
  });
});
