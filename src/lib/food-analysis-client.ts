/**
 * Food-label knowledge client.
 *
 * Analysis is computed by POST /api/food/analyze (guarded server route that
 * also runs the optional key-gated deep-search fallback). Responses are
 * deterministic and cached in memory per input text. If the server is
 * unreachable the SAME deterministic analysis is computed locally (the
 * knowledge base ships in the client bundle), so the feature degrades
 * gracefully to offline instead of showing an error.
 */

import type { FoodAnalysis, FoodAnalyzeOptions } from './food-knowledge/types';
import {
  analyzeFoodIngredientList,
  analyzeFoodText,
  splitFoodList,
} from './food-knowledge/analyze';

type AnalyzeInput = { text?: string; ingredients?: string[] };

interface Pending {
  status: 'idle' | 'loading' | 'ready' | 'error';
  analysis?: FoodAnalysis;
  offline?: boolean;
}

const memoryCache = new Map<string, FoodAnalysis>();

function keyOf(input: AnalyzeInput): string {
  return input.text !== undefined ? input.text : (input.ingredients ?? []).join('\u0001');
}

function localAnalysis(input: AnalyzeInput, options: FoodAnalyzeOptions): FoodAnalysis {
  return input.text !== undefined
    ? analyzeFoodText(input.text, options)
    : analyzeFoodIngredientList(input.ingredients ?? [], options);
}

const OFFLINE_FALLBACK = Symbol('offline');

async function remoteAnalysis(
  input: AnalyzeInput,
  options: FoodAnalyzeOptions & { language?: string },
): Promise<FoodAnalysis | typeof OFFLINE_FALLBACK> {
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
        ...(options.offAllergenTags ? { offAllergenTags: options.offAllergenTags } : {}),
        ...(options.language ? { language: options.language } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return OFFLINE_FALLBACK;
    return (await res.json()) as FoodAnalysis;
  } catch {
    return OFFLINE_FALLBACK;
  } finally {
    clearTimeout(timer);
  }
}

/** Analyze a food label list (or raw list text). Never throws. */
export async function analyzeFoodKnowledge(
  input: AnalyzeInput,
  options: FoodAnalyzeOptions & { language?: string } = {},
): Promise<Pending> {
  const cacheKey = keyOf(input);
  const cached = memoryCache.get(cacheKey);
  if (cached) return { status: 'ready', analysis: cached };
  const offline: FoodAnalysis = localAnalysis(input, options);
  const remote = await remoteAnalysis(input, options);
  if (remote === OFFLINE_FALLBACK) {
    return { status: 'ready', analysis: offline, offline: true };
  }
  memoryCache.set(cacheKey, remote);
  return { status: 'ready', analysis: remote };
}

/** Local-only analysis (used by offline rendering / tests). */
export function analyzeFoodKnowledgeLocal(
  input: AnalyzeInput,
  options: FoodAnalyzeOptions = {},
): FoodAnalysis {
  return localAnalysis(input, options);
}

/** Split + normalize a pasted food ingredient list. */
export function splitFoodLabel(text: string): string[] {
  return splitFoodList(text);
}
