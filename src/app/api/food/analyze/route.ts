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
 * allergens, E-number additive registry) and is deterministic. When
 * KNOWLEDGE_API_URL + KNOWLEDGE_API_KEY are configured, names the local base
 * does not recognise may be asked of the external knowledge slot; its answers
 * are returned ONLY as attributed informational `external` entries (clearly
 * flagged) and can never modify the local result. No config ⇒ the route is
 * purely local and never calls out. Failures fall back to the pure-local
 * result.
 *
 * The response contains no numeric score and makes no safety judgement:
 * allergen/additive presence is factual, structured information (EU Reg.
 * 1169/2011 & 1333/2008 context) — never "good"/"bad".
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TEXT_LENGTH = 12_000;
const MAX_INGREDIENTS = 300;
const ANALYSES_PER_MINUTE = 60;

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

  const foodText = asString(obj.foodText, MAX_TEXT_LENGTH);
  const label = asString(obj.label, 200);
  const category = asString(obj.category, 200);
  const language = typeof obj.language === 'string' && /^(en|fr|ar)$/.test(obj.language)
    ? obj.language
    : 'fr';
  const rawIngredients = Array.isArray(obj.ingredients) ? obj.ingredients : undefined;
  const rawTags = Array.isArray(obj.offAllergenTags) ? obj.offAllergenTags : undefined;
  const offAllergenTags =
    rawTags?.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean) ?? undefined;

  if (!foodText && !rawIngredients) {
    return NextResponse.json({ error: 'provide foodText or ingredients' }, { status: 400 });
  }
  if (rawIngredients && rawIngredients.length > MAX_INGREDIENTS) {
    return NextResponse.json(
      { error: `too many ingredients (max ${MAX_INGREDIENTS})` },
      { status: 400 },
    );
  }
  const items = rawIngredients?.map((t) => String(t).trim()).filter(Boolean) ?? [];
  if (items.some((t) => t.length > 500)) {
    return NextResponse.json({ error: 'ingredient too long' }, { status: 400 });
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

    // Optional deep-search fallback: ONLY unknown names, ONLY informational
    // attributed answers, fail-open.
    if (isKnowledgeConfigured() && result.unknownNames.length > 0) {
      const answers = await fetchKnowledgeSummaries(result.unknownNames, process.env, language);
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
