/**
 * Footer internal-link hygiene (SSR):
 *  - no nav column links the same URL twice with different anchors (crawlers
 *    count only the first link's anchor; duplicates read as manipulative);
 *  - the money pages stay reachable from the site-wide footer.
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../../messages/en.json';
import type { Messages } from '../../src/lib/i18n-core';

mock.module('@/lib/i18n-light', {
  namedExports: {
    useLightLanguage: () => ({
      language: 'en' as const,
      messages: en as Messages,
    }),
  },
});

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('footer links', () => {
  it('links each destination once per nav block and keeps money pages reachable', async () => {
    const { FooterSection } = await import('@/components/landing/footer-section');
    const html = renderToStaticMarkup(React.createElement(FooterSection));

    // Regression: /about used to appear twice in the Company column with two
    // different anchors ("About" + "About Private Budget Tracker").
    assert.equal(countOccurrences(html, 'href="/about"'), 1);

    for (const href of [
      '/features/multi-currency-mad',
      '/features/track-bank-home-wallet',
      '/features/no-bank-connection',
      '/budgeting-methods',
      '/blog',
      '/help',
      '/contact',
      '/privacy',
      '/terms',
    ]) {
      assert.ok(html.includes(`href="${href}"`), `footer should link ${href}`);
    }
  });
});
