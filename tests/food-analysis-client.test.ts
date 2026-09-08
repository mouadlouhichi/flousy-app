import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeFoodKnowledgeImmediate,
  analyzeFoodKnowledgeLocal,
  clearFoodAnalysisCache,
  foodAnalysisCacheKey,
} from '../src/lib/food-analysis-client';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearFoodAnalysisCache();
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('food analysis client cache and lifecycle', () => {
  it('keys every output-affecting context field and ignores signal identity', () => {
    const input = { text: 'Milk, E 330' };
    const base = foodAnalysisCacheKey(input, {
      label: 'Yogurt',
      category: 'Dairy',
      language: 'fr',
      offAllergenTags: ['en:milk', 'en:nuts'],
    });
    assert.equal(base, foodAnalysisCacheKey({ text: '  MILK,   E 330 ' }, {
      label: ' yogurt ',
      category: 'dairy',
      language: 'FR',
      offAllergenTags: ['EN:NUTS', 'en:milk'],
      signal: new AbortController().signal,
    }));
    assert.notEqual(base, foodAnalysisCacheKey(input, { label: 'Drink', category: 'Dairy', language: 'fr', offAllergenTags: ['en:milk', 'en:nuts'] }));
    assert.notEqual(base, foodAnalysisCacheKey(input, { label: 'Yogurt', category: 'Drink', language: 'fr', offAllergenTags: ['en:milk', 'en:nuts'] }));
    assert.notEqual(base, foodAnalysisCacheKey(input, { label: 'Yogurt', category: 'Dairy', language: 'ar', offAllergenTags: ['en:milk', 'en:nuts'] }));
    assert.notEqual(base, foodAnalysisCacheKey(input, { label: 'Yogurt', category: 'Dairy', language: 'fr', offAllergenTags: ['en:milk'] }));
    assert.notEqual(base, foodAnalysisCacheKey({ text: 'Milk, E 331' }, { label: 'Yogurt', category: 'Dairy', language: 'fr', offAllergenTags: ['en:milk', 'en:nuts'] }));
  });

  it('deduplicates same-context enrichment while preserving an enrichment subscription for every caller', async () => {
    clearFoodAnalysisCache();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let fetches = 0;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      fetches += 1;
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal(body.foodText, 'Milk, E330');
      assert.equal(body.label, 'Test food');
      assert.equal(body.category, 'Dairy');
      assert.equal(body.language, 'en');
      assert.deepEqual(body.offAllergenTags, ['en:milk']);
      await gate;
      const analysis = analyzeFoodKnowledgeLocal({ text: 'Milk, E330' }, {
        label: 'Test food',
        category: 'Dairy',
        offAllergenTags: ['en:milk'],
      });
      return jsonResponse({ ...analysis, deepSearched: true });
    }) as typeof fetch;

    const options = {
      label: 'Test food',
      category: 'Dairy',
      language: 'en',
      offAllergenTags: ['en:milk'],
    };
    const first = analyzeFoodKnowledgeImmediate({ text: 'Milk, E330' }, options);
    const second = analyzeFoodKnowledgeImmediate({ text: 'Milk, E330' }, options);
    assert.equal(fetches, 1);
    assert.ok(first.enrichment);
    assert.ok(second.enrichment, 'a same-context caller must subscribe to the pending enrichment');
    release();
    const [a, b] = await Promise.all([first.enrichment, second.enrichment]);
    assert.equal(a.analysis.deepSearched, true);
    assert.equal(b.analysis.deepSearched, true);
    assert.equal(a.analysis, b.analysis);
  });

  it('lets one subscriber cancel without aborting the shared request or poisoning its cache', async () => {
    clearFoodAnalysisCache();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let fetchSignal: AbortSignal | undefined;
    let fetches = 0;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      fetches += 1;
      fetchSignal = init?.signal as AbortSignal | undefined;
      await gate;
      const analysis = analyzeFoodKnowledgeLocal({ text: 'Peanuts, salt' });
      return jsonResponse({ ...analysis, deepSearched: true });
    }) as typeof fetch;

    const controller = new AbortController();
    const cancelled = analyzeFoodKnowledgeImmediate(
      { text: 'Peanuts, salt' },
      { language: 'en', signal: controller.signal },
    );
    const survivor = analyzeFoodKnowledgeImmediate(
      { text: 'Peanuts, salt' },
      { language: 'en' },
    );
    assert.ok(cancelled.enrichment);
    assert.ok(survivor.enrichment);
    controller.abort();
    await assert.rejects(cancelled.enrichment, (error: unknown) => (
      error instanceof Error && error.name === 'AbortError'
    ));
    assert.equal(fetchSignal?.aborted, false);
    release();
    const completed = await survivor.enrichment;
    assert.equal(completed.analysis.deepSearched, true);
    assert.equal(fetches, 1);

    const cached = analyzeFoodKnowledgeImmediate(
      { text: 'Peanuts, salt' },
      { language: 'en' },
    );
    assert.equal(cached.analysis.deepSearched, true);
    assert.equal(cached.enrichment, undefined);
    assert.equal(fetches, 1);
  });

  it('does not deduplicate requests whose language or allergen evidence differs', async () => {
    clearFoodAnalysisCache();
    let fetches = 0;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      fetches += 1;
      const body = JSON.parse(String(init?.body)) as { foodText: string };
      return jsonResponse(analyzeFoodKnowledgeLocal({ text: body.foodText }));
    }) as typeof fetch;

    const a = analyzeFoodKnowledgeImmediate({ text: 'Milk' }, { language: 'en', offAllergenTags: ['en:milk'] });
    const b = analyzeFoodKnowledgeImmediate({ text: 'Milk' }, { language: 'fr', offAllergenTags: ['en:milk'] });
    const c = analyzeFoodKnowledgeImmediate({ text: 'Milk' }, { language: 'en', offAllergenTags: ['en:nuts'] });
    await Promise.all([a.enrichment, b.enrichment, c.enrichment]);
    assert.equal(fetches, 3);
  });
});
