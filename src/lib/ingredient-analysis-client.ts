/**
 * Client for the self-hosted INCI analysis route.
 *
 * Thin wrapper over POST /api/inci/analyze with a small in-memory cache keyed
 * by the ingredient text (a scanned basket is repetitive, and analyses are
 * deterministic — same INCI text always yields the same result). Results are
 * never persisted and never leave the device beyond the same-origin call.
 *
 * Server-only data stays server-side: this module only ever sees the JSON
 * response, never the dataset loader.
 */

import type { ProductAssessment } from '@/lib/ingredient-safety/types';

export interface AnalyzeIngredientsOptions {
  label?: string;
  category?: string;
  form?: 'leave-on' | 'rinse-off' | 'unknown';
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 80;
const REQUEST_TIMEOUT_MS = 10_000;

const cache = new Map<string, { at: number; value: ProductAssessment }>();

function cacheKey(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function cacheGet(key: string): ProductAssessment | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, hit); // refresh LRU position
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

/** Empty the analysis cache (used by tests and future logout flows). */
export function clearIngredientAnalysisCache(): void {
  cache.clear();
}

/**
 * Analyze a product's full INCI text through the app's own route.
 * Throws on network failure / non-200 (callers render a muted fallback).
 */
export async function analyzeIngredientsText(
  ingredientsText: string,
  opts?: AnalyzeIngredientsOptions & { signal?: AbortSignal },
): Promise<ProductAssessment> {
  const key = cacheKey(ingredientsText);
  const cached = cacheGet(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  opts?.signal?.addEventListener('abort', onOuterAbort, { once: true });
  try {
    const res = await fetch('/api/inci/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inciText: ingredientsText,
        ...(opts?.label ? { label: opts.label } : {}),
        ...(opts?.category ? { category: opts.category } : {}),
        ...(opts?.form ? { form: opts.form } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ingredient analysis failed: HTTP ${res.status}`);
    const data = (await res.json()) as ProductAssessment;
    cacheSet(key, data);
    return data;
  } finally {
    clearTimeout(timer);
    opts?.signal?.removeEventListener('abort', onOuterAbort);
  }
}
