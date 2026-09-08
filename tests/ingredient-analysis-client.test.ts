import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeIngredientsText,
  clearIngredientAnalysisCache,
  ingredientAnalysisCacheKey,
} from '../src/lib/ingredient-analysis-client';
import { analyzeInciText } from '../src/lib/ingredient-safety/analyze';
import { INGREDIENT_ANALYSIS_CACHE_VERSION } from '../src/lib/ingredient-safety/version';

const originalFetch = globalThis.fetch;
const assessment = analyzeInciText('Aqua', {
  form: 'rinse-off',
  source: 'paste',
  reviewed: true,
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearIngredientAnalysisCache();
});

function response(value = assessment): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ingredient analysis client request identity', () => {
  it('includes text, form, label, category, source, and review state in the cache key', () => {
    const base = ingredientAnalysisCacheKey(' Aqua,  Glycerin ', {
      form: 'leave-on',
      label: 'Night cream',
      category: 'Face care',
      source: 'ocr',
      reviewed: true,
    });
    assert.ok(base.includes(INGREDIENT_ANALYSIS_CACHE_VERSION));
    assert.equal(base, ingredientAnalysisCacheKey('AQUA, GLYCERIN', {
      form: 'leave-on',
      label: ' night cream ',
      category: 'FACE CARE',
      source: 'ocr',
      reviewed: true,
    }));
    assert.notEqual(base, ingredientAnalysisCacheKey('Aqua, Glycerin', { form: 'rinse-off', label: 'Night cream', category: 'Face care', source: 'ocr', reviewed: true }));
    assert.notEqual(base, ingredientAnalysisCacheKey('Aqua, Glycerin', { form: 'leave-on', label: 'Soap', category: 'Face care', source: 'ocr', reviewed: true }));
    assert.notEqual(base, ingredientAnalysisCacheKey('Aqua, Glycerin', { form: 'leave-on', label: 'Night cream', category: 'Hair', source: 'ocr', reviewed: true }));
    assert.notEqual(base, ingredientAnalysisCacheKey('Aqua, Glycerin', { form: 'leave-on', label: 'Night cream', category: 'Face care', source: 'paste', reviewed: true }));
    assert.notEqual(base, ingredientAnalysisCacheKey('Aqua, Glycerin', { form: 'leave-on', label: 'Night cream', category: 'Face care', source: 'ocr', reviewed: false }));
  });

  it('deduplicates only identical complete contexts and forwards that context to the API', async () => {
    clearIngredientAnalysisCache();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const bodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(url), '/api/inci/analyze');
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      await gate;
      return response();
    }) as typeof fetch;

    const context = {
      form: 'leave-on' as const,
      label: 'Night cream',
      category: 'Face care',
      source: 'ocr' as const,
      reviewed: true,
    };
    const first = analyzeIngredientsText('Aqua, Glycerin', context);
    const second = analyzeIngredientsText('Aqua, Glycerin', context);
    assert.equal(bodies.length, 1);
    assert.deepEqual(bodies[0], {
      inciText: 'Aqua, Glycerin',
      label: 'Night cream',
      category: 'Face care',
      form: 'leave-on',
      source: 'ocr',
      reviewed: true,
    });
    release();
    const [a, b] = await Promise.all([first, second]);
    assert.deepEqual(a, b);

    await analyzeIngredientsText('Aqua, Glycerin', { ...context, form: 'rinse-off' });
    assert.equal(bodies.length, 2);
  });

  it('cancels one subscriber without aborting a shared request or losing the successful cache fill', async () => {
    clearIngredientAnalysisCache();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let requestSignal: AbortSignal | undefined;
    let fetches = 0;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      fetches += 1;
      requestSignal = init?.signal as AbortSignal | undefined;
      await gate;
      return response();
    }) as typeof fetch;

    const controller = new AbortController();
    const cancelled = analyzeIngredientsText('Aqua', {
      form: 'rinse-off', source: 'paste', reviewed: true, signal: controller.signal,
    });
    const survivor = analyzeIngredientsText('Aqua', {
      form: 'rinse-off', source: 'paste', reviewed: true,
    });
    controller.abort();
    await assert.rejects(cancelled, (error: unknown) => (
      error instanceof Error && error.name === 'AbortError'
    ));
    assert.equal(requestSignal?.aborted, false);
    release();
    await survivor;
    assert.equal(fetches, 1);

    await analyzeIngredientsText('Aqua', {
      form: 'rinse-off', source: 'paste', reviewed: true,
    });
    assert.equal(fetches, 1);
  });

  it('does not cache failed requests and retries the same context', async () => {
    clearIngredientAnalysisCache();
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return fetches === 1
        ? new Response('upstream unavailable', { status: 503 })
        : response();
    }) as typeof fetch;

    await assert.rejects(analyzeIngredientsText('Aqua', { reviewed: true }), /HTTP 503/);
    await analyzeIngredientsText('Aqua', { reviewed: true });
    assert.equal(fetches, 2);
  });

  it('evicts the least-recently-used assessment when the 80-entry bound is exceeded', async () => {
    clearIngredientAnalysisCache();
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return response();
    }) as typeof fetch;

    for (let index = 0; index < 81; index += 1) {
      await analyzeIngredientsText(`Aqua, unique-${index}`, { reviewed: true });
    }
    assert.equal(fetches, 81);
    await analyzeIngredientsText('Aqua, unique-0', { reviewed: true });
    assert.equal(fetches, 82, 'oldest key should have been evicted rather than retained without a bound');
  });
});
