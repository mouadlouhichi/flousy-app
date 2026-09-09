# Label knowledge — food ingredient analysis (feature guide) 2

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
- recognition coverage + per-ingredient chips; generic declarations such as
  “colour” remain unresolved and are labelled as exact-substance unspecified;
- optional **deep-search fallback** (below).

## Where the panel lives

1. **In the course scan flow** — the pending-product card picks the panel by
   resolved domain: cosmetic labels (Open Beauty Facts / INCI) keep the score
   glance; food labels get the food-knowledge panel. Domain is resolved from
   source declarations, category, name and INCI-like text
   (`src/lib/food-knowledge/domain.ts`); ambiguity remains `unknown` rather
   than being guessed from the source database.
2. **Standalone screen `/dashboard/knowledge`** — Pro users can scan or type
   any barcode (no course session needed), see the product card, save it to
   the product catalog, and get the same automatically selected domain-aware
   panel. There is no product-type selector in the scan interaction. A manual
   food-label paste box remains available without a successful barcode scan.

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

### Grade drivers (2026-09-food-v4)

`foodGradeDrivers` mirrors the rubric exactly and ranks up to three label
signals that moved the grade, strongest first (additive code / concern label,
localized band, point cost). The expanded food panel renders the ranking under
a "what moved the label score" heading whenever a grade exists; a withheld
grade (nothing recognized, mineral water) never gets a breakdown.

Corpus `2026-09-food-v4` (2026-09-09) extends market coverage for
Moroccan/North-African labels: Arabic ingredient wording is now foldable and
matched (`foldForMatch` keeps every Unicode letter/digit and strips combining
marks, so `أ` folds to `ا`), with new family rows (spices such as cumin,
coriander, curcuma, ginger, fenugrek; dates, figs, mackerel; vinegar, coffee,
chicory, malt extract; Arabic staples such as `ملح`, `سكر`, `زيت النخيل`,
`طماطم`), and four new explicitly-unresolved class declarations
(`conservateur`, `antioxydant`, `stabilisant`, `édulcorant`) which are
chip-labelled "exact substance not specified" and never count as recognized
identities.

## Deep-search knowledge fallback (optional, key-gated)

The analysis always runs against the **local** knowledge tables first
(`src/lib/food-knowledge/lists.ts`: families, allergens, additive registry;
`concerns.ts`: explicit non-additive concern registry).
When `KNOWLEDGE_API_URL` and `KNOWLEDGE_API_KEY` are both configured and some
names remain genuinely unidentified, `POST /api/food/analyze` sends ONLY those
names (≤ 40) to an OpenAI-compatible chat-completions endpoint (DeepSeek,
OpenAI, a self-hosted gateway… — point the URL anywhere compatible) and asks
for short, neutral explanations in the requested language. Generic label
classes such as “colour” or “flavour enhancers” are explained locally as
unspecified identities and are not forwarded.

Guardrails (same philosophy as the cosmetics vendor slot):

- no config ⇒ **zero network** — the route is purely local;
- answers are returned **only** as `external` entries, attributed to the
  provider host and collapsed behind an "external source — not verified by
  the app" disclosure; they never modify local verdicts (coverage, families,
  allergens, additives and ingredient concerns all stay local);
- bounded (4 s timeout, ≤ 40 names, summary ≤ 400 chars) and fail-open — any
  error returns the exact pure-local result.

## Offline, cache identity, and privacy

The client (`src/lib/food-analysis-client.ts`) renders the deterministic local
analysis immediately, caches it in a bounded/expiring context-complete cache,
and optionally replaces it with attributed server enrichment. Cache identity
includes text, label, category, language, OFF allergen tags, and dataset
version; in-flight work is deduplicated and components reject stale request
completions. OFF allergen tags are used only as a source-attributed cross-check.

Label text is sent to the app's same-origin analysis endpoint. If an optional
knowledge provider is configured, only bounded, genuinely unidentified
ingredient names and the requested explanation language are forwarded. The
label photo stays on-device. The OCR worker/core are served same-origin; the
explicitly selected language data may be downloaded from Tesseract’s configured
CDN on first use. OCR text and parsed rows require editable user confirmation
before analysis.

All barcode surfaces use the same strict GTIN and abortable resolution path.
The resulting domain is one of `food`, `cosmetic`, `household`, `pet`, or
`unknown`; source database is provenance rather than proof of domain. The
Knowledge screen routes automatically from that metadata and has no visible
domain selector. An unknown scanned domain receives no guessed analyzer;
household/pet products show metadata without claiming an ingredient analyzer
is available.

## Tests

- `tests/food-knowledge.test.ts` — lists + engine (photo-label and English
  Pringles fixtures, allergen lookalikes, additives, coverage, heading strip,
  determinism);
- `tests/knowledge-search.test.ts` — slot config/parsing/bounds/fail-open;
- `tests/food-knowledge-api.test.ts` — route guards, disclosure minimization,
  and deep-search wiring;
- `tests/scanner-lifecycle.test.ts` — acquisition lifecycle plus the selector-
  free/animated Knowledge scan contract;
- message parity and rendered unresolved-class copy (en/fr/ar) are regression-
  covered.
