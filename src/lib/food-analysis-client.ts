/** Context-complete, bounded food-label analysis cache. */

import type { FoodAnalysis, FoodAnalyzeOptions } from './food-knowledge/types';
import {
  analyzeFoodIngredientList,
  analyzeFoodText,
  splitFoodList,
} from './food-knowledge/analyze';
import { FOOD_DATASET_VERSION } from './food-knowledge/lists';
import { MAX_INGREDIENT_TEXT_LENGTH } from './ingredient-safety/types';

type AnalyzeInput = { text?: string; ingredients?: string[] };
export type FoodAnalysisContext = FoodAnalyzeOptions & {
  language?: string;
  /** Cancels only this subscriber; the shared same-context enrichment may
   * continue for other consumers and populate the bounded cache. */
  signal?: AbortSignal;
};

export interface FoodAnalysisResult {
  status: 'ready';
  analysis: FoodAnalysis;
  offline?: boolean;
}

export interface ImmediateFoodAnalysis extends FoodAnalysisResult {
  /** Optional source-attributed server enrichment. Local output is usable now. */
  enrichment?: Promise<FoodAnalysisResult>;
}

const MAX_CACHE_ENTRIES = 100;
const CACHE_TTL_MS = 30 * 60_000;
const memoryCache = new Map<string, { analysis: FoodAnalysis; expiresAt: number }>();
const inFlight = new Map<string, Promise<FoodAnalysisResult>>();

function assertBoundedInput(input: AnalyzeInput, options: FoodAnalysisContext): void {
  if ((input.text?.trim().length ?? 0) > MAX_INGREDIENT_TEXT_LENGTH) {
    throw new RangeError('food label text is too long');
  }
  const ingredients = input.ingredients ?? [];
  if (
    !Array.isArray(ingredients)
    || ingredients.length > 300
    || ingredients.some((item) => typeof item !== 'string' || item.trim().length > 500)
  ) throw new RangeError('invalid food ingredient list');
  if (
    ingredients.reduce((length, item) => length + item.trim().length, 0)
      + Math.max(0, ingredients.length - 1) * 2 > MAX_INGREDIENT_TEXT_LENGTH
  ) throw new RangeError('food ingredient list is too long');
  if ((options.label?.trim().length ?? 0) > 200 || (options.category?.trim().length ?? 0) > 200) {
    throw new RangeError('food analysis context is too long');
  }
  const tags = options.offAllergenTags ?? [];
  if (tags.length > 50 || tags.some((tag) => tag.trim().length > 100)) {
    throw new RangeError('food allergen context is too long');
  }
  if ((options.language?.trim().length ?? 0) > 16) {
    throw new RangeError('food language context is too long');
  }
}

function normalizeKeyText(value: string | undefined): string {
  return (value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('und');
}

export function foodAnalysisCacheKey(input: AnalyzeInput, options: FoodAnalysisContext = {}): string {
  assertBoundedInput(input, options);
  return JSON.stringify({
    version: FOOD_DATASET_VERSION,
    input: input.text !== undefined
      ? { text: normalizeKeyText(input.text) }
      : { ingredients: (input.ingredients ?? []).map(normalizeKeyText) },
    label: normalizeKeyText(options.label),
    category: normalizeKeyText(options.category),
    language: normalizeKeyText(options.language),
    allergens: [...(options.offAllergenTags ?? [])].map(normalizeKeyText).sort(),
  });
}

function localAnalysis(input: AnalyzeInput, options: FoodAnalyzeOptions): FoodAnalysis {
  return input.text !== undefined
    ? analyzeFoodText(input.text, options)
    : analyzeFoodIngredientList(input.ingredients ?? [], options);
}

function setCache(key: string, analysis: FoodAnalysis): void {
  memoryCache.delete(key);
  memoryCache.set(key, { analysis, expiresAt: Date.now() + CACHE_TTL_MS });
  while (memoryCache.size > MAX_CACHE_ENTRIES) {
    const oldest = memoryCache.keys().next().value as string | undefined;
    if (!oldest) break;
    memoryCache.delete(oldest);
  }
}

function getCache(key: string): FoodAnalysis | undefined {
  const value = memoryCache.get(key);
  if (!value) return undefined;
  if (value.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  memoryCache.delete(key);
  memoryCache.set(key, value);
  return value.analysis;
}

function abortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('Analysis cancelled', 'AbortError');
  return Object.assign(new Error('Analysis cancelled'), { name: 'AbortError' });
}

function forSubscriber<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    request.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function remoteAnalysis(input: AnalyzeInput, options: FoodAnalysisContext): Promise<FoodAnalysis | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const res = await fetch('/api/food/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(input.text !== undefined ? { foodText: input.text } : { ingredients: input.ingredients }),
        ...(options.label ? { label: options.label } : {}),
        ...(options.category ? { category: options.category } : {}),
        ...(options.offAllergenTags?.length ? { offAllergenTags: options.offAllergenTags } : {}),
        ...(options.language ? { language: options.language } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as FoodAnalysis;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function enrich(
  key: string,
  input: AnalyzeInput,
  options: FoodAnalysisContext,
  fallback: FoodAnalysis,
): Promise<FoodAnalysisResult> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const request = remoteAnalysis(input, options)
    .then((remote) => {
      const analysis = remote ?? fallback;
      setCache(key, analysis);
      return remote
        ? { status: 'ready' as const, analysis }
        : { status: 'ready' as const, analysis, offline: true as const };
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

/** Render deterministic local output immediately, then optionally enrich it. */
export function analyzeFoodKnowledgeImmediate(
  input: AnalyzeInput,
  options: FoodAnalysisContext = {},
): ImmediateFoodAnalysis {
  const key = foodAnalysisCacheKey(input, options);
  const cached = getCache(key);
  const pending = inFlight.get(key);
  if (cached) {
    return {
      status: 'ready',
      analysis: cached,
      ...(pending ? { enrichment: forSubscriber(pending, options.signal) } : {}),
    };
  }
  const local = localAnalysis(input, options);
  setCache(key, local);
  const request = enrich(key, input, options, local);
  return {
    status: 'ready',
    analysis: local,
    offline: true,
    enrichment: forSubscriber(request, options.signal),
  };
}

/** Compatibility async API: resolves with attributed enrichment when available. */
export async function analyzeFoodKnowledge(
  input: AnalyzeInput,
  options: FoodAnalysisContext = {},
): Promise<FoodAnalysisResult> {
  const immediate = analyzeFoodKnowledgeImmediate(input, options);
  return immediate.enrichment ? immediate.enrichment : immediate;
}

export function analyzeFoodKnowledgeLocal(
  input: AnalyzeInput,
  options: FoodAnalyzeOptions = {},
): FoodAnalysis {
  assertBoundedInput(input, options);
  return localAnalysis(input, options);
}

export function splitFoodLabel(text: string): string[] {
  return splitFoodList(text);
}

/** Test-only cache reset without exposing cached label contents. */
export function clearFoodAnalysisCache(): void {
  memoryCache.clear();
  inFlight.clear();
}
