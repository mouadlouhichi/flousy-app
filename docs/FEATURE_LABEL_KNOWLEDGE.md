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
signals that raised the risk, strongest first (additive code / concern label /
vague class wording, localized band, risk points). The expanded food panel
renders the ranking under a "what raises the risk" heading whenever a grade
exists; a withheld grade (nothing recognized, mineral water) never gets a
breakdown.

### Vague-label rubric + risk presentation (2026-09-food-v5)

Product-owner direction after a same-product comparison showed the vaguer
label scoring **better** (94 vs 85) purely because it omitted E-numbers:

- every **distinct unspecified class declaration** ("flavour enhancers",
  "food acid", "protein", "colour", "preservative", "antioxidant",
  "stabiliser", "sweetener") now deducts 15 points — the same as a watch
  additive — so omitting specificity can never read as safer than declaring;
- a class word whose **E-range is enumerated elsewhere on the same label**
  (e.g. "colour" alongside colorant E160b, or "flavour enhancer" alongside
  E621) is transparent wording and is NOT penalized — "color" + "colorant
  (annatto E160b)" is one declaration the parser splits, not hidden vagueness;
- a truncated label that leaves a stray closing bracket (the reported
  `chili extract)` fragment) no longer leaks the bracket into the ingredient
  identity; the cosmetic parse stays conservatively invalid;
- presentation follows the cosmetic side: the ring and chips show the risk
  direction (`100 − index`, higher = riskier) with risk-worded band labels.

### NOVA processing group (2026-09-nova-v1)

Open Food Facts reports a **NOVA group** (1 unprocessed or minimally
processed … 4 ultra-processed food or drink) for many products. It is fetched
(`nova_group`, `nova_groups`), persisted on the product document, on expense
attachments and on session lines, and rendered by the food panel as its own
section: a `NOVA {group}` chip, the group's label, and a note naming the
source.

NOVA is **not** part of the label-signal grade and never will be by mixing:

- the grade is reproducible from the printed wording alone (additives,
  concerns, vague classes, recognition coverage) — the same input always
  yields the same number on any device;
- NOVA depends on how the product was *made*, which a printed ingredient list
  cannot establish, and it is a single attributed value in a third-party
  record rather than an auditable local derivation.

Mixing them would make the ring unreproducible and would let a provider field
silently move a number the UI presents as computed from the label. The two are
therefore shown side by side, each labelled with what it is: the ring is the
label-signal index, the chip is a source-reported classification.

Only values 1–4 are accepted; anything else (`0`, `5`, `"unknown"`, `""`, a
fraction, an object) is dropped rather than defaulted, at the mapper, in the
Firestore rules and in the backup parser.

### Yuka-style risk ring + vitamins (2026-09-food-v6)

Product-owner direction: the expanded food panel must lead with the same
Yuka-style coloured **risk ring** as the INCI side. `FoodKnowledgeBody` now
renders the ring (100 − grade, band-coloured arc, scale caption, band label)
above the ranked drivers. The reported orange-juice label
("orange juice, water, sugar, acidifier: citric acid, vitamin c, natural
flavour") previously read risk 6 because bare "vitamin c" was unrecognized and
the partial-coverage cap fired (100 → 94); corpus `2026-09-food-v6` recognizes
declared vitamins (A/B6/B12/C/D/E/K in EN/FR/Arabic incl. `فيتامين س`,
tocopherol, folate) and Arabic water (`ماء`), so that label now reads fully
recognized with risk 0 and no drivers.

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
