import { NextRequest, NextResponse } from 'next/server';
import { analyzeInciText, analyzeIngredientList } from '@/lib/ingredient-safety/analyze';
import type { ProductForm } from '@/lib/ingredient-safety/types';
import { isRateLimited } from '@/lib/server/rate-limit';
import { checkArcjet } from '@/lib/server/arcjet';

/**
 * INCI analysis API — the "ingredient intelligence" layer of the beauty-score
 * feature.
 *
 * POST JSON:
 * {
 *   "inciText": "Aqua, Glycerin, Niacinamide, Parfum",   // full label list
 *   // — or —
 *   "ingredients": ["Aqua", "Glycerin"],                 // pre-split tokens
 *   "form":     "leave-on" | "rinse-off" | "unknown",    // optional
 *   "label":    "La Roche-Posay …",                      // optional (echoed)
 *   "category": "Moisturizers"                            // optional (form hint)
 * }
 *
 * Everything runs against the LOCAL CosIng snapshot + the versioned EU overlay
 * (src/lib/ingredient-safety/*). No third-party call, no user data leaves the
 * server, and the whole pipeline is deterministic — the same INCI text always
 * returns the same JSON, so scores are auditable and reproducible.
 *
 * The response includes dataset freshness metadata; treat any aggregate score
 * as informational (see docs/COSMETIC_INGREDIENT_SCORING.md).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TEXT_LENGTH = 12_000;
const MAX_INGREDIENTS = 300;
const ANALYSES_PER_MINUTE = 60;

const FORMS = new Set(['leave-on', 'rinse-off', 'unknown']);

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
  if (await isRateLimited('inci', ip, ANALYSES_PER_MINUTE, 60_000)) {
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

  const inciText = asString(obj.inciText, MAX_TEXT_LENGTH);
  const label = asString(obj.label, 200);
  const category = asString(obj.category, 200);
  const rawIngredients = Array.isArray(obj.ingredients) ? obj.ingredients : undefined;
  const form: ProductForm | undefined =
    typeof obj.form === 'string' && FORMS.has(obj.form) ? (obj.form as ProductForm) : undefined;

  if (!inciText && !rawIngredients) {
    return NextResponse.json(
      { error: 'provide inciText or ingredients' },
      { status: 400 },
    );
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
    const result = inciText
      ? analyzeInciText(inciText, { form, label, category })
      : analyzeIngredientList(items, { form, label, category });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const unavailable = message.includes('dataset not found');
    return NextResponse.json(
      {
        error: unavailable ? 'dataset unavailable' : 'analysis failed',
        ...(unavailable ? { detail: message } : {}),
      },
      { status: unavailable ? 503 : 500 },
    );
  }
}
