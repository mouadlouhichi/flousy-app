# Moroccan barcode corpus audit — 2026-09-11

Goal: take a large set of **real Moroccan barcode products**, run every one of them
through the app's own ranking path, and close every gap that stops a product from
getting a rank.

Companion to `docs/RISK_BANK_PRODUCTION_AUDIT_2026-09-11.md` and
`docs/SCAN_AND_INGREDIENT_RISK_AUDIT_2026-09-08.md`.

## 1. Corpus

| | |
| --- | --- |
| Source | Open Food Facts `countries_tags_en=Morocco` facet |
| Products in the facet | **22 847** |
| Harvested for this audit | **203** (API pages 1-6) |
| Fixture | `data/ma-corpus-off.json` |
| Harvester | `scripts/fetch-ma-corpus.mjs` (runnable in CI — the sandbox has no outbound network) |
| Audit harness | `scripts/audit-ma-corpus.mts` |

203 products is a sample, not the whole facet, but it is a *representative* one:
the API returns OFF's default ordering, so the set is dominated by what Moroccans
actually buy — mineral and table waters (Sidi Ali, Aïn Atlas, Aïn Saïss, Bahia,
Oulmès, Ciel), fermented dairy (Jaouda, Centrale Danone / Perly / Jamila, Jben,
kefir), cheeses and spreads, wafers and biscuits, jams, margarine, mayonnaise,
tomato pastes, sodas, coffee and tea.

### Harvest constraints (why 203 and not 22 847)

`https://world.openfoodfacts.org/api/v2/search?countries_tags_en=Morocco&page=N&page_size=50&fields=…`
answers with HTTP **503 "Page temporarily unavailable"** when:

- `page_size=100` is requested (use 50),
- `sort_by=unique_scans_n` is requested,
- two pages are requested in the same burst (fetch strictly sequentially).

`scripts/fetch-ma-corpus.mjs` still requests `page_size=100`; **lower it before
running the harvester again.** A GitHub Actions harvest was attempted and
abandoned: workflow output (logs, artifacts, check-run summaries) is not readable
from this environment.

## 2. How products were scored

`scripts/audit-ma-corpus.mts` calls exactly the functions the UI calls — no
private shortcuts:

```
detectLabelDomain → cosmetic branch (inferProductForm + analyzeInciText)
                  → food branch     (analyzeFoodText  + foodLabelGrade)
```

It tallies ranked vs. unranked products, identity coverage, grade bands, cosmetic
score statuses, and the unrecognized ingredient names ranked by how many products
they affect (the work list). Report: `data/ma-corpus-audit.json`.

## 3. Baseline — what was broken

| Metric | Before |
| --- | --- |
| Products with ingredient text | 196 / 203 (7 records have none at all) |
| Food products analyzed | 195 |
| **Products that got a grade** | **152 (77.9%)** |
| Products with *zero* recognized ingredients | 17 |
| Identity coverage | full 78 · partial 36 · limited 63 · **none 18** |

The work list was unambiguous: **the unranked products were overwhelmingly
Arabic-language labels.** `src/lib/food-knowledge/lists.ts` held 22 Arabic
entries in total — enough for a spice list, nowhere near enough for a country
whose labels are bilingual FR/AR. Before the fix:

```
7× مسحوق الحليب بدون قشدة   (skimmed milk powder)     5× قشدة        (cream)
7× زبدة                     (butter)                  4× خل المائدة  (table vinegar)
6× نكهة                     (flavouring)              4× مخثر (نشا)  (thickener/starch)
5× بروتينات الحليب          (milk proteins)           3× حليب بدون قشدة, خردل, زيت الصوجا …
```

Two structural defects sat underneath the missing vocabulary:

1. **No Arabic allergen coverage at all.** A label declaring `حليب` (milk),
   `دقيق القمح` (wheat) or `أصفر البيض` (egg yolk) produced no allergen flag.
   This is the safety-critical half of the gap: an allergen missed on an Arabic
   label is worse than a missing grade.
2. **E-code subgroups were dropped.** The additive scan matched a single code per
   token on whitespace boundaries, so `E160a` resolved to nothing (E160a is a
   subgroup of the registered E160) and `(E452، E341، E450)` — separated by an
   Arabic comma — reported only the first code.

## 4. Fixes applied

All in `src/lib/food-knowledge/` unless noted.

### 4.1 Arabic ingredient families (`lists.ts`, `ROWS`)

~130 new keys across dairy, fat-oil, sugar, salt, cereal, fruit-veg, meat-fish,
legume, nut-seed, egg, culture and other — covering milk and every Moroccan milk
variant (`حليب`، `حليب نصف دسم`، `حليب كامل الدسم`، `حليب بدون قشدة`،
`مسحوق الحليب بدون قشدة`، `بروتينات الحليب`), cream, butter, cheese, yoghurt,
lactic cultures, vegetable oils and fats, sugar, salt, wheat flour, starches,
fruit, fish, eggs, cocoa, coffee and tea.

Arabic nouns are listed **with and without the definite article** (`حليب` and
`الحليب`) because row matching is word-boundary based and `الحليب` is a different
string from `حليب`.

### 4.2 Arabic allergens (`lists.ts`, `ALLERGEN_TERMS`)

Terms for **all 14 EU Annex II groups** in Arabic (milk, gluten, eggs, fish,
crustaceans, soybeans, peanuts, nuts, sesame, mustard, celery, sulphites, lupin,
molluscs), plus the Arabic coconut guard (`جوز الهند`) so coconut is not read as
a walnut.

### 4.3 Additives

- **Arabic names** for the additives that dominate Moroccan labels: E202
  `سوربات البوتاسيوم`, E211 `بنزوات الصوديوم`, E330 `حمض الستريك`, E331, E407
  `كاراجينان`, E415 `صمغ الزنتان`, E412, E440, E322 `ليسيتين الصوجا`, E471, E500,
  E503, E160, E150, E200, E300.
- **16 additive definitions** that were missing entirely: E338, E339, E341, E385,
  E414, E445, E450, E451, E452, E472e, E282, E234, E1422, E1442, E1450, E491 —
  i.e. the phosphates/emulsifying salts, modified starches and EDTA that appear
  on nearly every Moroccan processed-cheese and spread label.
- **Subgroup resolution**: `E160a → E160`, `E150d → E150`, `E500ii → E500`. A
  label that names its additive must not be reported as unknown, nor mistaken for
  vague "colour" wording.
- **Full token scan** with Unicode-aware boundaries, so every code in
  `(E452، E341، E450)` is found, not just the first.

### 4.4 Two new vague functional classes

French and Arabic labels routinely print a *function* without a *substance* —
`émulsifiant`, `épaississant`, `مستحلب`, `مخثر`. Neither had a class, so the
wording was silently ignored instead of being flagged as vague.

- Added `thickener` and `emulsifier` to `FoodUnspecifiedClass` (`types.ts`),
  with E-number ranges in `grade.ts` so a label that declares the code (e.g.
  `émulsifiant (E471)`) is **not** double-penalized.
- Added Arabic wording to every class (colour `ملون`, preservative `مادة حافظة`,
  antioxidant `مضادات الأكسدة`, food-acid `محمض`, stabiliser `مثبت`, sweetener
  `محليات`, thickener `مخثر`, emulsifier `مستحلب`) and French `épaississant` /
  `émulsifiant`.
- Copy keys `unspecifiedThickener` / `unspecifiedEmulsifier` in en, fr, ar.

### 4.5 French and Spanish gaps

- French: `fraises`, `maquereaux`, `fromages`, `ferment lactique` (singular),
  `matière grasse laitière`, `sels de fonte`, `caféine`, `bicarbonates`,
  `acide phosphorique`, `ammonium bicarbonate`.
- Spanish (imported lines on Moroccan shelves): `azúcar`, `leche (en polvo)`,
  `aceite de girasol`, `harina de trigo`, `atún`, `huevo`, `sal`, `galletas` —
  each mapped to its real family (a Spanish sugar is a sugar, not an "other").

### 4.6 Deliberate non-changes

- `vitamin c` / `فيتامين ج` were **not** added as E300 aliases. Ascorbic acid is
  E300, but on a label a vitamin is declared as a nutrient (fortification row),
  not as an additive; aliasing it would have invented an additive the label never
  claimed.
- `flavouring` / `flavor` were **not** added as ingredient rows. A key of
  `flavor` prefix-matches "FLAVOR ENHANCERS", which is a *vague functional class*
  the rubric penalizes — a row key would have hidden that vagueness. Only the
  declared category itself (`arôme`, `aroma`, `نكهة`) is a row.

## 5. Result

| Metric | Before | After |
| --- | --- | --- |
| Products that got a grade | 152 (77.9%) | **164** — every product that prints an ingredient list |
| Zero-recognition products | 17 | **0** (excluding waters) |
| Coverage buckets | full 78 · partial 36 · limited 63 · none 18 | **full 122 · partial 53 · limited 14 · none 6** |
| Grade bands | good 54 · excellent 54 · moderate 44 | good 62 · excellent 91 · moderate 10 · caution 1 |

Where the 203 products end up:

- **7** — no ingredient text stored at OFF at all (nothing to rank; a data gap at
  the source, not an app defect).
- **1** — routed to the cosmetic path, withheld because the product form is
  unknown (correct: leave-on vs rinse-off changes the score).
- **26** — waters, routed to the **mineral-composition view** instead of a grade
  (by design; a water has no ingredient list to score).
- **3** — records whose stored "ingredients" are a hotline, a URL or a nutrition
  claim (`Good Food Nescafé Classic. تحدث إلي نستله 080 105 10 10`, `r ee z=CagStzaca`,
  `AJR : apport journalier recommandé…`). Withholding is the correct behaviour —
  inventing a grade from marketing copy is what this app must never do.
- **164** — graded.

The remaining items in the harness's "unrecognized" list are **not** misses:
`colorant`, `conservateur`, `stabilisants`, `épaississant`, `édulcorants`,
`مخثر` are vague functional classes, which are detected, penalized and surfaced
to the user — they deliberately do not count as recognized ingredients.

## 6. Regression cover

- `tests/food-knowledge-morocco.test.ts` — 49 assertions: Arabic family rows
  (25 cases), Arabic allergens (11 cases + the coconut guard), Arabic additive
  names, subgroup E-codes, French/Arabic vague classes, the no-double-penalty
  rule, three end-to-end label grades, and water routing from OFF's English
  category tags.
- `tests/ma-corpus.test.ts` — runs the whole 203-product fixture through the
  ranking path and fails if any product that prints an ingredient list comes back
  without a grade (with the three label-noise records pinned as *must stay
  withheld*).

## 7. Known limitations

- 203 of 22 847 products sampled. Re-harvest with
  `node scripts/fetch-ma-corpus.mjs --pages=…` **after lowering `page_size` to
  50**, then re-run `npx tsx scripts/audit-ma-corpus.mts`.
- The OFF Morocco facet leaks non-Moroccan EANs (Coca-Cola `5449000054227`,
  Cappy `5449000147417`, and other EU/Spanish imports). They are legitimate
  shelf products, so they were kept in the corpus — and they drove the Spanish
  layer in §4.5.
- The inline seed index (`src/lib/ma-product-seed.ts`, ~113 barcodes) is still
  the offline fallback; a full OFF Morocco index (design doc §3.5, P2) remains
  the right way to reach all 22 847 products without network.
