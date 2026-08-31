import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BLOG_POSTS } from '../src/lib/blog';
import { getLocalizedBlogPosts } from '../src/lib/blog-locales';

describe('localized blog editions', () => {
  for (const language of ['fr', 'ar'] as const) {
    it(`keeps every ${language} article complete and aligned with its canonical post`, () => {
      const localizedPosts = getLocalizedBlogPosts(language);

      assert.equal(localizedPosts.length, BLOG_POSTS.length);

      BLOG_POSTS.forEach((englishPost) => {
        const localizedPost = localizedPosts.find((post) => post.slug === englishPost.slug);
        assert.ok(localizedPost, `${language} is missing ${englishPost.slug}`);
        assert.notEqual(localizedPost.title, englishPost.title, `${language} title is untranslated`);
        assert.notEqual(localizedPost.excerpt, englishPost.excerpt, `${language} excerpt is untranslated`);
        assert.equal(localizedPost.sections.length, englishPost.sections.length);

        localizedPost.sections.forEach((section, index) => {
          const englishSection = englishPost.sections[index];
          assert.notEqual(section.heading, englishSection.heading, `${language} heading is untranslated`);
          assert.equal(section.paragraphs.length, englishSection.paragraphs.length);
          section.paragraphs.forEach((paragraph, paragraphIndex) => {
            assert.ok(paragraph.trim(), `${language} paragraph must not be blank`);
            assert.notEqual(
              paragraph,
              englishSection.paragraphs[paragraphIndex],
              `${language} paragraph is untranslated`,
            );
          });
          assert.equal(section.bullets?.length ?? 0, englishSection.bullets?.length ?? 0);
          assert.equal(Boolean(section.callout), Boolean(englishSection.callout));
        });
      });
    });
  }
});
