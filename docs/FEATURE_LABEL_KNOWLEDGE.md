# Label knowledge — food ingredient analysis (feature guide)

Extends the scanned-label feature (see
[COSMETIC_INGREDIENT_SCORING.md](./COSMETIC_INGREDIENT_SCORING.md) for the
cosmetics/INCI side) to **food** labels, and auto-detects which side a label
belongs to.

A barcode scan of a dairy label such as

> Ingrédients : Lait de Vache pasteurisé, Crème fraîche pasteurisée,
> ferments lactiques, Présure, Sel.

now produces a **food-knowledge panel** with structured, EU-referenced
knowledge. The analysis payload itself makes no general health verdict:

- recognized **families** for each ingredient (dairy, ferment/culture, salt…);
- the **14 EU major allergen groups** (Reg. (EU) No 1169/2011 Annex II),
  presented as information — presence concerns allergic/intolerant people and
  never changes the label score;
- **E-number additives** (Reg. (EC) No 1333/2008) with a permitted/watch/
  not-permitted band and EU notice flags (child-activity warning colours,
  phenylalanine for aspartame, no-longer-authorised additives such as E171);
- narrow **explicit ingredient concerns** that do not carry an E number. The
  first registry entry is partially hydrogenated oil: WHO identifies PHOs as
  the main source of industrial trans fat, while Reg. (EU) 2019/649 caps trans
  fat other than that naturally occurring in animal fat at 2 g/100 g fat.
  Detection is a source signal, not a
  claim that the product exceeds that quantitative limit;
- recognition coverage + per-ingredient chips;
- optional **deep-search fallback** (below).

## Where the panel lives

1. **In the course scan flow** — the pending-product card now picks the panel
   by domain: cosmetic labels (Open Beauty Facts / INCI) keep the score
   glance; food labels get the food-knowledge panel. Domain is detected from
   the beauty/food source, category, name and INCI-like text
   (`src/lib/food-knowledge/domain.ts`); ambiguous cases default to food.
2. **Standalone screen `/dashboard/knowledge`** — Pro users can scan or type
   any barcode (no course session needed), see the product card, save it to
   the product catalog, and get the same domain-aware panel. A label paste
   box is always available (free) — knowledge analysis never requires a scan.

## Food label-signal grade

The collapsed course accordion shows a deterministic 0–100 **label-signal
index**, not Nutri-Score and not a nutrition/health score. It is computed in
`src/lib/food-knowledge/grade.ts` from exactly what the expanded panel shows:

- start at 100;
- each `watch` additive: −15;
- each additive no longer authorised in the EU: −60 and hard cap at 34;
- explicit high ingredient concern (currently partially hydrogenated oil):
  −45 and hard cap at 59 (`caution` at best);
- permitted/neutral additives: no deduction;
- allergens: no deduction (they stay a separate safety disclosure);
- unknown ingredients are neither punished nor treated as clean: partial
  recognition caps the result below `excellent`, limited recognition caps it
  at 79, and zero recognized ingredients produces no score.

This narrow rubric fixes the false-perfect case where an explicit industrial
trans-fat source previously passed through because it was neither an E-number
nor an allergen. It still does not infer sugar, salt, saturated-fat or nutrient
quantities from ingredient order; use declared nutrition data/Nutri-Score for
that separate question.

## Deep-search knowledge fallback (optional, key-gated)

The analysis always runs against the **local** knowledge tables first
(`src/lib/food-knowledge/lists.ts`: families, allergens, additive registry;
`concerns.ts`: explicit non-additive concern registry).
When `KNOWLEDGE_API_URL` and `KNOWLEDGE_API_KEY` are both configured and some
names remain unrecognized, `POST /api/food/analyze` sends ONLY those names
(≤ 40) to an OpenAI-compatible chat-completions endpoint (DeepSeek, OpenAI, a
self-hosted gateway… — point the URL anywhere compatible) and asks for short,
neutral explanations in the requested language.

Guardrails (same philosophy as the cosmetics vendor slot):

- no config ⇒ **zero network** — the route is purely local;
- answers are returned **only** as `external` entries, attributed to the
  provider host and collapsed behind an "external source — not verified by
  the app" disclosure; they never modify local verdicts (coverage, families,
  allergens, additives and ingredient concerns all stay local);
- bounded (4 s timeout, ≤ 40 names, summary ≤ 400 chars) and fail-open — any
  error returns the exact pure-local result.

## Offline & privacy

The client (`src/lib/food-analysis-client.ts`) falls back to computing the
same deterministic local analysis in the browser when the API is unreachable.
Only the ingredient names leave the device (to the app's own server, then to
the optional knowledge provider), never user data.

## Tests

- `tests/food-knowledge.test.ts` — lists + engine (photo-label fixture,
  allergen lookalikes, additives, coverage, heading strip, determinism);
- `tests/knowledge-search.test.ts` — slot config/parsing/bounds/fail-open;
- `tests/food-knowledge-api.test.ts` — route guards + deep-search wiring;
- message parity (en/fr/ar) is enforced by the existing catalog test.
