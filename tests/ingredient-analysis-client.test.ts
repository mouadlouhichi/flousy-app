import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeIngredientsText,
  clearIngredientAnalysisCache,
  IngredientAnalysisError,
  ingredientAnalysisCacheKey,
  isOffline,
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

  it('rejects oversized text/context before allocating a cache entry or request', async () => {
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return response();
    }) as typeof fetch;
    assert.throws(
      () => ingredientAnalysisCacheKey('A'.repeat(12_001)),
      /ingredient text is too long/,
    );
    await assert.rejects(
      analyzeIngredientsText('Aqua', { label: 'A'.repeat(201) }),
      /ingredient analysis context is too long/,
    );
    assert.equal(fetches, 0);
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

  it('classifies a failed request so the UI can explain it and offer a retry', async () => {
    clearIngredientAnalysisCache();
    const cases: Array<[number, string]> = [
      [429, 'rate-limited'],
      [503, 'service'],
      [500, 'service'],
      [400, 'invalid'],
    ];
    for (const [status, kind] of cases) {
      globalThis.fetch = (async () => new Response('nope', { status })) as typeof fetch;
      const error = await analyzeIngredientsText(`Aqua, case-${status}`, { reviewed: true })
        .then(() => null, (cause: unknown) => cause);
      assert.ok(error instanceof IngredientAnalysisError, `HTTP ${status}`);
      assert.equal(error.kind, kind, `HTTP ${status}`);
      assert.equal(error.retryable, kind !== 'invalid');
    }
  });

  it('reports a network failure instead of a generic error and never caches it', async () => {
    clearIngredientAnalysisCache();
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const error = await analyzeIngredientsText('Aqua, offline-case', { reviewed: true })
      .then(() => null, (cause: unknown) => cause);
    assert.ok(error instanceof IngredientAnalysisError);
    assert.equal(error.kind, 'network');
    globalThis.fetch = (async () => {
      fetches += 1;
      return response();
    }) as typeof fetch;
    await analyzeIngredientsText('Aqua, offline-case', { reviewed: true });
    assert.equal(fetches, 2, 'a failed analysis must not be cached as a result');
  });

  it('fails fast without a request when the browser reports no connection', async () => {
    clearIngredientAnalysisCache();
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches += 1;
      return response();
    }) as typeof fetch;
    const online = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(navigator),
      'onLine',
    );
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    try {
      assert.equal(isOffline(), true);
      const error = await analyzeIngredientsText('Aqua, no-network', { reviewed: true })
        .then(() => null, (cause: unknown) => cause);
      assert.ok(error instanceof IngredientAnalysisError);
      assert.equal(error.kind, 'offline');
      assert.equal(fetches, 0, 'an offline device should not spend a request');
    } finally {
      delete (navigator as { onLine?: boolean }).onLine;
      if (online) Object.defineProperty(navigator, 'onLine', online);
    }
    assert.equal(isOffline(), false);
  });
});
