import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sitemap from '../src/app/sitemap';
import robots from '../src/app/robots';
import { metadata as loginMetadata } from '../src/app/login/layout';
import { BLOG_POSTS } from '../src/lib/blog';
import { SUPPORTED_CURRENCIES } from '../src/lib/currency';
import { staticPageMetadata } from '../src/lib/page-meta';
import { resolveHydratedTitle } from '../src/lib/document-title';
import {
  BUDGETING_STRATEGIES,
  DEFAULT_ROBOTS,
  LANDING_FAQS,
  OG_IMAGE,
  OG_LOCALE,
  SITE_URL,
  SUPPORTED_CURRENCY_CODES,
  TWITTER_CARD,
} from '../src/lib/seo';
import type { Messages } from '../src/lib/i18n-core';

const llmsText = readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');

function readCatalog(locale: string): Messages {
  return JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')) as Messages;
}

const catalogs = {
  en: readCatalog('en'),
  fr: readCatalog('fr'),
  ar: readCatalog('ar'),
};
const englishMessages = JSON.parse(
  readFileSync(new URL('../messages/en.json', import.meta.url), 'utf8'),
) as {
  landing: {
    faq: {
      items: Array<{ question: string; answer: string; link?: { label: string; href: string } }>;
    };
  };
};

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

  it('keeps visible English FAQs, structured data, and llms.txt aligned', () => {
    assert.deepStrictEqual(englishMessages.landing.faq.items, LANDING_FAQS);

    const pricingAnswer = LANDING_FAQS.find((faq) => faq.question === 'Is SmartJib free?')?.answer;
    assert.ok(pricingAnswer);
    assert.ok(llmsText.includes(pricingAnswer));
  });

  it('publishes llms.txt as Markdown with detectable links', () => {
    // Lighthouse's agentic-browsing audit requires llms.txt to be Markdown
    // with an H1 and real `[label](url)` links — bare URLs are not counted.
    assert.match(llmsText, /^# .+/m);
    const markdownLinks = llmsText.match(/\[[^\]]+\]\(https:\/\/[^)]+\)/g) ?? [];
    assert.ok(
      markdownLinks.length >= 10,
      `llms.txt should publish Markdown links, found ${markdownLinks.length}`,
    );
  });

  it('shares one social/robots baseline across public pages', () => {
    assert.equal(OG_LOCALE, 'en_US');
    assert.equal(TWITTER_CARD, 'summary_large_image');
    assert.deepStrictEqual(DEFAULT_ROBOTS, {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    });
    assert.equal(OG_IMAGE.url, '/opengraph-image');
    assert.equal(OG_IMAGE.width, 1200);
    assert.equal(OG_IMAGE.height, 630);
  });

  it('gives every static marketing page a canonical, social image and indexable robots', () => {
    const meta = staticPageMetadata('about', 'About SmartJib', 'Why SmartJib exists.');
    assert.deepStrictEqual(meta.title, { absolute: 'About SmartJib' });
    assert.deepStrictEqual(meta.alternates, { canonical: '/about' });
    assert.deepStrictEqual(meta.robots, DEFAULT_ROBOTS);

    const og = meta.openGraph as {
      title?: unknown;
      url?: unknown;
      locale?: unknown;
      images?: unknown;
    } | null;
    assert.ok(og);
    assert.equal(og.title, 'About SmartJib');
    assert.equal(og.url, `${SITE_URL}/about`);
    assert.equal(og.locale, 'en_US');
    assert.deepStrictEqual(og.images, [OG_IMAGE]);

    const twitter = meta.twitter as { card?: unknown; images?: unknown } | null;
    assert.ok(twitter);
    assert.equal(twitter.card, 'summary_large_image');
    assert.deepStrictEqual(twitter.images, [OG_IMAGE.url]);
  });

  it('keeps the public login entry crawlable with full social tags', () => {
    assert.deepStrictEqual(loginMetadata.robots, { index: true, follow: true });
    const og = loginMetadata.openGraph as { url?: unknown; images?: unknown } | null;
    assert.ok(og);
    assert.equal(og.url, '/login');
    assert.deepStrictEqual(og.images, [OG_IMAGE]);
    const twitter = loginMetadata.twitter as { card?: unknown; images?: unknown } | null;
    assert.ok(twitter);
    assert.equal(twitter.card, 'summary_large_image');
    assert.deepStrictEqual(twitter.images, [OG_IMAGE.url]);
  });

  it('keeps prerendered titles on public pages for English sessions', () => {
    // Google renders JavaScript: a hydration overwrite of the keyword-bearing
    // SSR <title> is what would end up in the index.
    for (const path of [
      '/',
      '/about',
      '/help',
      '/careers',
      '/contact',
      '/cookies',
      '/privacy',
      '/terms',
      '/blog',
      '/login',
      '/onboarding',
      '/features',
      '/features/multi-currency-mad',
      '/features/track-bank-home-wallet',
      '/features/expense-tracking',
      '/features/no-bank-connection',
      '/budgeting-methods',
      '/budgeting-methods/50-30-20-rule',
      '/budgeting-methods/zero-based-budgeting',
      '/budgeting-methods/envelope-budgeting',
      '/budgeting-methods/pay-yourself-first',
      '/blog/what-its-for-vs-where-it-is',
    ]) {
      assert.equal(
        resolveHydratedTitle(path, 'en', catalogs.en, 'SmartJib'),
        null,
        `${path} should keep its prerendered title`,
      );
    }
  });

  it('localizes dashboard tab titles in every locale', () => {
    assert.equal(
      resolveHydratedTitle('/dashboard/fixed', 'en', catalogs.en, 'SmartJib'),
      `${catalogs.en.navigation.fixedBills} · SmartJib`,
    );
    assert.equal(
      resolveHydratedTitle('/dashboard', 'ar', catalogs.ar, 'SmartJib'),
      `${catalogs.ar.navigation.dashboardOverview} · SmartJib`,
    );
  });

  it('localizes mapped public titles off-English without touching unmapped marketing routes', () => {
    assert.equal(
      resolveHydratedTitle('/blog', 'fr', catalogs.fr, 'SmartJib'),
      `${catalogs.fr.seo.titles.blog} · SmartJib`,
    );
    assert.equal(
      resolveHydratedTitle('/about', 'ar', catalogs.ar, 'SmartJib'),
      `${catalogs.ar.static.about.eyebrow} · SmartJib`,
    );
    assert.equal(resolveHydratedTitle('/', 'fr', catalogs.fr, 'SmartJib'), catalogs.fr.seo.titles.landing);

    for (const path of [
      '/features',
      '/features/no-bank-connection',
      '/budgeting-methods/pay-yourself-first',
      '/blog/pick-a-budgeting-style',
    ]) {
      assert.equal(
        resolveHydratedTitle(path, 'fr', catalogs.fr, 'SmartJib'),
        null,
        `${path} should keep its prerendered title`,
      );
    }
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

    assert.ok(urls.includes(`${SITE_URL}/login`));
    for (const privatePath of ['/dashboard', '/onboarding']) {
      assert.ok(!urls.includes(`${SITE_URL}${privatePath}`));
    }

    const robotsConfig = robots();
    assert.equal(robotsConfig.sitemap, `${SITE_URL}/sitemap.xml`);
    const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules : [robotsConfig.rules];
    const defaultRule = rules.find((rule) => rule.userAgent === '*');
    assert.ok(defaultRule);
    assert.ok(!defaultRule.disallow?.includes('/login'));
    assert.deepStrictEqual(loginMetadata.robots, { index: true, follow: true });
  });
});
