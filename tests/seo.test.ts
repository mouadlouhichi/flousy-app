import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sitemap from '../src/app/sitemap';
import robots from '../src/app/robots';
import { BLOG_POSTS } from '../src/lib/blog';
import { SUPPORTED_CURRENCIES } from '../src/lib/currency';
import {
  BUDGETING_STRATEGIES,
  LANDING_FAQS,
  SITE_URL,
  SUPPORTED_CURRENCY_CODES,
} from '../src/lib/seo';

const llmsText = readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');

describe('SEO and GEO configuration', () => {
  it('keeps published currency and strategy facts aligned with the application', () => {
    assert.deepStrictEqual(SUPPORTED_CURRENCY_CODES, Object.keys(SUPPORTED_CURRENCIES));
    assert.match(llmsText, /12 currencies supported/i);

    for (const code of SUPPORTED_CURRENCY_CODES) {
      assert.ok(llmsText.includes(code), `${code} should be listed in llms.txt`);
    }

    for (const strategy of BUDGETING_STRATEGIES) {
      assert.ok(llmsText.includes(strategy), `${strategy} should be listed in llms.txt`);
    }
  });

  it('keeps the free-plan description identical in the FAQ and llms.txt', () => {
    const pricingAnswer = LANDING_FAQS.find((faq) => faq.question === 'Is Flousy free?')?.answer;
    assert.ok(pricingAnswer);
    assert.ok(llmsText.includes(pricingAnswer));
  });

  it('publishes public routes while excluding private routes from the sitemap', () => {
    const urls = sitemap().map((entry) => entry.url);
    assert.ok(urls.includes(SITE_URL));
    assert.ok(urls.includes(`${SITE_URL}/privacy`));
    assert.ok(urls.includes(`${SITE_URL}/terms`));

    for (const post of BLOG_POSTS) {
      assert.ok(urls.includes(`${SITE_URL}/blog/${post.slug}`));
      assert.ok(llmsText.includes(`${SITE_URL}/blog/${post.slug}`));
    }

    for (const privatePath of ['/login', '/dashboard', '/onboarding']) {
      assert.ok(!urls.includes(`${SITE_URL}${privatePath}`));
    }

    const robotsConfig = robots();
    assert.equal(robotsConfig.sitemap, `${SITE_URL}/sitemap.xml`);
  });
});
