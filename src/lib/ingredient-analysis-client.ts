/** Context-complete, bounded client for the same-origin INCI analysis route. */

import type { ParserSummary, ProductAssessment, ProductForm } from '@/lib/ingredient-safety/types';
import { INGREDIENT_ANALYSIS_CACHE_VERSION } from '@/lib/ingredient-safety/version';

export interface AnalyzeIngredientsOptions {
  label?: string;
  category?: string;
  form?: ProductForm;
  source?: ParserSummary['source'];
  reviewed?: boolean;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 80;
const REQUEST_TIMEOUT_MS = 10_000;

const cache = new Map<string, { at: number; value: ProductAssessment }>();
const inFlight = new Map<string, Promise<ProductAssessment>>();

function normalizePart(value: string | undefined): string {
  return (value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function ingredientAnalysisCacheKey(
  text: string,
  opts?: AnalyzeIngredientsOptions,
): string {
  return JSON.stringify([
    INGREDIENT_ANALYSIS_CACHE_VERSION,
    normalizePart(text),
    opts?.form ?? 'infer',
    normalizePart(opts?.label),
    normalizePart(opts?.category),
    opts?.source ?? 'paste',
    opts?.reviewed === true,
  ]);
}

function cacheGet(key: string): ProductAssessment | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key: string, value: ProductAssessment): void {
  cache.delete(key);
  cache.set(key, { at: Date.now(), value });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function abortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('The operation was aborted.', 'AbortError');
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

/** Give each subscriber independent cancellation; aborting one waiter never
 * cancels the shared in-flight request used by another component. */
function waitForSubscriber<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        if (!signal.aborted) resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        if (!signal.aborted) reject(error);
      },
    );
  });
}

export function clearIngredientAnalysisCache(): void {
  cache.clear();
  inFlight.clear();
}

async function requestAnalysis(
  ingredientsText: string,
  opts: AnalyzeIngredientsOptions | undefined,
): Promise<ProductAssessment> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch('/api/inci/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inciText: ingredientsText,
        ...(opts?.label ? { label: opts.label } : {}),
        ...(opts?.category ? { category: opts.category } : {}),
        ...(opts?.form ? { form: opts.form } : {}),
        source: opts?.source ?? 'paste',
        reviewed: opts?.reviewed === true,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`ingredient analysis failed: HTTP ${response.status}`);
    return (await response.json()) as ProductAssessment;
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeIngredientsText(
  ingredientsText: string,
  opts?: AnalyzeIngredientsOptions & { signal?: AbortSignal },
): Promise<ProductAssessment> {
  const context: AnalyzeIngredientsOptions = {
    ...(opts?.label ? { label: opts.label } : {}),
    ...(opts?.category ? { category: opts.category } : {}),
    ...(opts?.form ? { form: opts.form } : {}),
    ...(opts?.source ? { source: opts.source } : {}),
    ...(opts?.reviewed !== undefined ? { reviewed: opts.reviewed } : {}),
  };
  const key = ingredientAnalysisCacheKey(ingredientsText, context);
  const cached = cacheGet(key);
  if (cached) return waitForSubscriber(Promise.resolve(cached), opts?.signal);

  let shared = inFlight.get(key);
  if (!shared) {
    shared = requestAnalysis(ingredientsText, context).then((value) => {
      cacheSet(key, value);
      return value;
    });
    inFlight.set(key, shared);
    void shared.finally(() => {
      if (inFlight.get(key) === shared) inFlight.delete(key);
    }).catch(() => undefined);
  }
  return waitForSubscriber(shared, opts?.signal);
}
