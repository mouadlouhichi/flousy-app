import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeFoodIngredientList,
  analyzeFoodText,
} from '@/lib/food-knowledge/analyze';
import {
  fetchKnowledgeSummaries,
  isKnowledgeConfigured,
  knowledgeConfig,
} from '@/lib/server/knowledge-search';
import { isRateLimited } from '@/lib/server/rate-limit';
import { checkArcjet } from '@/lib/server/arcjet';
import { MAX_INGREDIENT_TEXT_LENGTH } from '@/lib/ingredient-safety/types';

/**
 * Food-label knowledge analysis API.
 *
 * POST JSON:
 * {
 *   "foodText": "Lait de vache pasteurisé, crème fraîche …", // full label list
 *   // — or —
 *   "ingredients": ["Lait de vache pasteurisé", "…"],          // pre-split
 *   "label": "Fromage blanc …",            // optional (echoed)
 *   "category": "Dairies",                 // optional (echoed)
 *   "language": "fr",                      // optional, for the deep-search slot
 *   "offAllergenTags": ["en:milk"]         // optional cross-check (OFF data)
 * }
 *
 * Analysis runs against the LOCAL food-knowledge base (families, EU Annex II
 * allergens, E-number additives and explicit ingredient concerns) and is
 * deterministic. When
 * KNOWLEDGE_API_URL + KNOWLEDGE_API_KEY are configured, names the local base
 * does not recognise may be asked of the external knowledge slot; its answers
 * are returned ONLY as attributed informational `external` entries (clearly
 * flagged) and can never modify the local result. No config ⇒ the route is
 * purely local and never calls out. Failures fall back to the pure-local
 * result.
 *
 * The response contains no numeric score and makes no general food-safety
 * verdict. Allergen/additive presence and explicit concern-source wording are
 * returned as factual, structured signals with regulatory context.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_INGREDIENTS = 300;
const MAX_ALLERGEN_TAGS = 50;
const MAX_ALLERGEN_TAG_LENGTH = 100;
/** Same carrier-NAT rationale as `/api/inci/analyze`: one shopper's realistic
 * rate is a few labels per trip, and shared mobile IPs must not be throttled
 * before that. The analysis runs against the local corpus and is cheap. */
const ANALYSES_PER_MINUTE = 180;

function asString(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s || s.length > max) return undefined;
  return s;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'local';
  const arcjet = await checkArcjet(request);
  if (arcjet.denied) {
    return NextResponse.json({ error: 'blocked' }, { status: 403 });
  }
  if (await isRateLimited('food-knowledge', ip, ANALYSES_PER_MINUTE, 60_000)) {
    return NextResponse.json(
      { error: 'too many analyses' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const obj = (body ?? {}) as Record<string, unknown>;

  if (
    (obj.foodText !== undefined && (
      typeof obj.foodText !== 'string'
      || obj.foodText.trim().length > MAX_INGREDIENT_TEXT_LENGTH
    ))
    || (obj.label !== undefined && (typeof obj.label !== 'string' || obj.label.trim().length > 200))
    || (obj.category !== undefined && (typeof obj.category !== 'string' || obj.category.trim().length > 200))
  ) {
    return NextResponse.json({ error: 'invalid text field' }, { status: 400 });
  }
  if (obj.ingredients !== undefined && !Array.isArray(obj.ingredients)) {
    return NextResponse.json({ error: 'ingredients must be an array' }, { status: 400 });
  }
  if (obj.offAllergenTags !== undefined && !Array.isArray(obj.offAllergenTags)) {
    return NextResponse.json({ error: 'allergen tags must be an array' }, { status: 400 });
  }
  if (obj.language !== undefined && (typeof obj.language !== 'string' || !/^(en|fr|ar)$/.test(obj.language))) {
    return NextResponse.json({ error: 'invalid language' }, { status: 400 });
  }

  const foodText = asString(obj.foodText, MAX_INGREDIENT_TEXT_LENGTH);
  const label = asString(obj.label, 200);
  const category = asString(obj.category, 200);
  const language = typeof obj.language === 'string' ? obj.language : 'fr';
  const rawIngredients = Array.isArray(obj.ingredients) ? obj.ingredients : undefined;
  const rawTags = Array.isArray(obj.offAllergenTags) ? obj.offAllergenTags : undefined;
  if (rawTags && (
    rawTags.length > MAX_ALLERGEN_TAGS
    || rawTags.some((tag) => typeof tag !== 'string')
  )) {
    return NextResponse.json({ error: 'invalid allergen tags' }, { status: 400 });
  }
  const offAllergenTags = (rawTags as string[] | undefined)?.map((tag) => tag.trim()).filter(Boolean);
  if (offAllergenTags?.some((tag) => tag.length > MAX_ALLERGEN_TAG_LENGTH)) {
    return NextResponse.json({ error: 'invalid allergen tags' }, { status: 400 });
  }

  if (!foodText && !rawIngredients) {
    return NextResponse.json({ error: 'provide foodText or ingredients' }, { status: 400 });
  }
  if (rawIngredients && rawIngredients.length > MAX_INGREDIENTS) {
    return NextResponse.json(
      { error: `too many ingredients (max ${MAX_INGREDIENTS})` },
      { status: 400 },
    );
  }
  if (rawIngredients?.some((item) => typeof item !== 'string')) {
    return NextResponse.json({ error: 'ingredients must be strings' }, { status: 400 });
  }
  const items = (rawIngredients as string[] | undefined)?.map((item) => item.trim()).filter(Boolean) ?? [];
  if (!foodText && items.length === 0) {
    return NextResponse.json({ error: 'provide at least one ingredient' }, { status: 400 });
  }
  if (items.some((item) => item.length > 500)) {
    return NextResponse.json({ error: 'ingredient too long' }, { status: 400 });
  }
  const aggregateLength = items.reduce((length, item) => length + item.length, 0)
    + Math.max(0, items.length - 1) * 2;
  if (aggregateLength > MAX_INGREDIENT_TEXT_LENGTH) {
    return NextResponse.json({ error: 'ingredient list too long' }, { status: 400 });
  }

  try {
    const options = {
      ...(label ? { label } : {}),
      ...(category ? { category } : {}),
      ...(offAllergenTags ? { offAllergenTags } : {}),
    };
    const result = foodText
      ? analyzeFoodText(foodText, options)
      : analyzeFoodIngredientList(items, options);

    // Optional deep-search fallback: only genuinely unidentified names. A
    // generic class such as “colour” already says all the label tells us, so
    // sending it externally would disclose text without resolving an identity.
    // Answers remain attributed, informational, and fail-open.
    const externalLookupNames = result.ingredients
      .filter((ingredient) => !ingredient.recognized && !ingredient.unspecifiedClass)
      .map((ingredient) => ingredient.raw);
    if (isKnowledgeConfigured() && externalLookupNames.length > 0) {
      const answers = await fetchKnowledgeSummaries(externalLookupNames, process.env, language);
      if (answers.length > 0) {
        const host = safeHost(knowledgeConfig(process.env)?.url);
        result.external = answers.map((a) => ({
          name: a.name,
          summary: a.summary,
          source: host,
        }));
        result.deepSearched = true;
      }
    }

    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return NextResponse.json({ error: 'analysis failed', detail: message }, { status: 500 });
  }
}

function safeHost(url: string | undefined): string {
  if (!url) return 'external knowledge provider';
  try {
    return new URL(url).hostname;
  } catch {
    return 'external knowledge provider';
  }
}
