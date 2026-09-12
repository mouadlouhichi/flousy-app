/** Context-complete, bounded client for the same-origin INCI analysis route. */

import {
  MAX_INGREDIENT_TEXT_LENGTH,
  type ParserSummary,
  type ProductAssessment,
  type ProductForm,
} from '@/lib/ingredient-safety/types';
import { INGREDIENT_ANALYSIS_CACHE_VERSION } from '@/lib/ingredient-safety/version';

export interface AnalyzeIngredientsOptions {
  label?: string;
  category?: string;
  form?: ProductForm;
  source?: ParserSummary['source'];
  reviewed?: boolean;
}

/**
 * Why an ingredient analysis could not be completed.
 *
 * Production reality: the scan surface is used on phones in supermarkets, so
 * "offline", "rate limited" and "service down" are ordinary states, not
 * exceptions. Each maps to distinct, actionable UI copy and only the
 * retryable kinds expose a retry action.
 */
export type IngredientAnalysisFailureKind =
  | 'offline'
  | 'rate-limited'
  | 'service'
  | 'network'
  | 'timeout'
  | 'invalid';

export class IngredientAnalysisError extends Error {
  readonly kind: IngredientAnalysisFailureKind;

  constructor(kind: IngredientAnalysisFailureKind, message: string) {
    super(message);
    this.name = 'IngredientAnalysisError';
    this.kind = kind;
  }

  get retryable(): boolean {
    return this.kind !== 'invalid';
  }
}

/** Best-effort connectivity probe; `navigator` is absent on the server. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 80;
const REQUEST_TIMEOUT_MS = 10_000;

const cache = new Map<string, { at: number; value: ProductAssessment }>();
const inFlight = new Map<string, Promise<ProductAssessment>>();

function normalizePart(value: string | undefined): string {
  return (value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function assertBoundedContext(text: string, opts?: AnalyzeIngredientsOptions): void {
  if (text.trim().length > MAX_INGREDIENT_TEXT_LENGTH) {
    throw new RangeError('ingredient text is too long');
  }
  if ((opts?.label?.trim().length ?? 0) > 200 || (opts?.category?.trim().length ?? 0) > 200) {
    throw new RangeError('ingredient analysis context is too long');
  }
}

export function ingredientAnalysisCacheKey(
  text: string,
  opts?: AnalyzeIngredientsOptions,
): string {
  assertBoundedContext(text, opts);
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
  // Fail fast and honestly instead of waiting for a request that cannot
  // succeed: a supermarket with no signal is the normal case for this feature.
  if (isOffline()) {
    throw new IngredientAnalysisError('offline', 'device is offline');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch('/api/inci/analyze', {
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
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new IngredientAnalysisError('timeout', 'ingredient analysis timed out');
    }
    throw new IngredientAnalysisError(
      isOffline() ? 'offline' : 'network',
      'ingredient analysis request failed',
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const kind: IngredientAnalysisFailureKind =
      response.status === 429 ? 'rate-limited'
        : response.status >= 500 ? 'service'
          : 'invalid';
    throw new IngredientAnalysisError(kind, `ingredient analysis failed: HTTP ${response.status}`);
  }
  try {
    return (await response.json()) as ProductAssessment;
  } catch {
    throw new IngredientAnalysisError('service', 'ingredient analysis returned an unreadable body');
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
  }
  // A failed request must leave the in-flight map before the caller resumes:
  // a rejected promise left behind would be handed to the next caller for the
  // same key, so a transient failure (offline scan, 429, 503) could never be
  // retried inside the TTL. The cleanup is attached to the same promise the
  // caller awaits, which is what makes the ordering hold; the abort path in
  // `waitForSubscriber` rejects separately and never cancels a shared request.
  const caller = shared.then(
    (value) => {
      if (inFlight.get(key) === shared) inFlight.delete(key);
      return value;
    },
    (error: unknown) => {
      if (inFlight.get(key) === shared) inFlight.delete(key);
      throw error;
    },
  );
  return waitForSubscriber(caller, opts?.signal);
}
