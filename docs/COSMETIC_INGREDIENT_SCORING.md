# Cosmetic ingredient scoring (INCI → risk levels → score)

Deterministic, local, EU-regulatory-first ingredient scoring for scanned
cosmetics. Everything lives in `src/lib/ingredient-safety/` + the data file
`data/cosing/cosing-ingredients.tsv`, exposed over one API route:

```
POST /api/inci/analyze     JSON → { score, band, coverage, ingredients[], flags[], dataset }
```

No third-party INCI service is called. The dataset and the regulatory overlay
are bundled with the app, the analysis is a pure function of the label text,
and only barcode/INCI digits ever leave the device (and only to this route) —
the same privacy stance as the rest of the app.

---

## 1. Data sources

| Layer | What it provides | Freshness | Location |
| --- | --- | --- | --- |
| **EU CosIng** (official inventory export) | INCI ↔ CAS/EC, cosmetic *functions*, raw *restriction* text with annex codes | snapshot **2019-03-13** (mirrored), merged 2026-09-07 | `data/cosing/cosing-ingredients.tsv` (28,733 rows) |
| **Identifier layer** (beauteeru, MIT) | CAS/EC + ~2.7k extra INCI names not in the 2019 export | 2024-era | merged into the same TSV |
| **EU overlay** (code) | Rules adopted **after** the 2019 snapshot + label-pattern signals: Annex II bans (Lilial 2022, HICC 2021, long-chain parabens 2015, triclosan 2014…), Annex III leave-on caps (retinol 2024/996, MIT/MCI), Reg (EU) 2023/1545 fragrance allergens, generic "Parfum", drying alcohols, sulfates, historical comedogenicity | versioned in code, dated 2026-09-07 | `src/lib/ingredient-safety/eu-lists.ts` |

Why the split: the official CosIng CSV has **no JSON API** and is published as
bulk exports on the EC portal / data.europa.eu (no stable endpoint; the
sandboxed network cannot reach it, so the repo ships a mirror snapshot + a
refresh script). And a 2019 export cannot know about a 2022 ban — so the
*regulatory rules* are maintained in code where they can be reviewed, tested
and dated, while the *ingredient catalogue* stays data.

Refresh procedure: `node scripts/fetch-cosing.mjs` (official endpoints) or the
manual mirror steps — see `data/cosing/README.md`.

**Legal note (kept in the UI/data docs too):** CosIng is informative and has
no legal value; presence in it is not an authorization. This engine renders an
*informational* risk index — it is not a medical opinion and not a
compliance/legal statement about a product or its sale in any country.

---

## 2. Name resolution (`normalize.ts`, `dataset.ts`)

A label token is matched to the dataset through, in order:

1. **Normalization**: NFKC fold, uppercase, punctuation → spaces,
   `C.I. 77491 → CI 77491`.
2. **Exact key** against the normalized dataset.
3. **Curated alias map** — common-name → INCI (`WATER→AQUA`, `coconut oil→
   Cocos Nucifera Oil`, `Vitamin E→Tocopherol`, …).
4. **Parenthetical stripping** — `AQUA (WATER) → AQUA`; `Cocos Nucifera
   (Coconut) Oil` matches even when the label omits the annotation. A
   stripped lookup only fires when it identifies **exactly one** dataset row,
   so the engine never guesses between two ingredients.

Unmatched names are reported as *unknown* (see coverage) — never guessed,
never silently "safe".

The INCI list parser (`splitInciList`) handles "INGREDIENTS:" headings,
bullets/numbering, CRLF line lists and commas inside parentheses (multi-name
INCI like `Hydrolyzed (…/…) Fruit Extract`).

---

## 3. Risk levels

Every recognized ingredient ends up in one of five tiers. Tiers come from
*signals*; an ingredient can carry several (e.g. `LINALOOL` = CosIng row +
fragrance allergen), the strongest wins.

| Tier | Meaning | Typical signals | Deduction |
| --- | --- | --- | --- |
| `prohibited` | Listed on EU Annex II (banned), or banned by a later amendment | `cosing-annex-II` (e.g. Hydroquinone `II/1339`), EU overlay (`Lilial`, `HICC`, parabens, triclosan…) | 100 (hard cap → 35/avoid) |
| `restricted` | EU Annex III conditions or leave-on concentration caps | `cosing-annex-III` (e.g. Salicylic acid `III/98`), overlay (`Methylisothiazolinone` rinse-off-only, retinol caps) | 45 |
| `caution` | Declarable fragrance allergens, generic "Parfum", formaldehyde releasers; leave-on-only conditions | `eu-fragrance-allergen`, `fragrance-generic`, `formaldehyde-releaser`, `eu-restricted` in leave-on | 22 |
| `watch` | Mild comfort flags — historical comedogenicity, drying alcohol, sulfates, rinse-off allergens | `comedogenic-history`, `drying-alcohol`, `sulfate-surfactant` (leave-on only) | 10 |
| `clean` | Recognized, no negative signal (e.g. Aqua, Glycerin, Niacinamide) | — | 0 |

`unrecognized` is **not** a tier: it lowers coverage and never produces a
deduction (an unknown name is neither assumed safe nor assumed harmful).

### What the signals say — and what they don't

- **Annex codes** are parsed from the CosIng restriction text
  (`II/1339`, `III/98`, `V/29`…) and map to signals *only for II (prohibited)*
  and *III (restricted)*. Annex **IV/V/VI** mentions (approved colourants,
  preservatives, UV filters) are informational notes — being on a positive
  list with limits is normal, not a penalty.
- **Fragrance allergens** (26 substances of Directive 2003/15/EC + the
  Reg (EU) 2023/1545 additions, labelling in force for new products since
  2026-07-31) are *contact* allergens: significance depends on the individual.
  They score `caution` on leave-on and drop to `watch` on rinse-off, mirroring
  the EU's own 10× higher rinse-off labelling threshold
  (0.001% leave-on / 0.01% rinse-off).
- **Comedogenicity** is from historical rabbit-ear ratings (Fulton 1984). The
  method's limits are documented (dilution/formulation/human variation —
  Draelos & DiNardo 2006; Mirshahpanah & Maibach 2007), so it only ever
  produces the mildest `watch` flag, leave-on only, with the caveat in the
  detail text. Products are not declared "acne-causing" from a list.
- **Generic "Parfum"** is `caution`: its composition is legally undeclared
  (only EU-declarable allergens must be listed separately). Not a hazard
  verdict — a flag for fragrance-sensitive users.
- **Sulfate surfactants & drying alcohols** are EU-allowed and mostly matter
  for skin tolerance in leave-on products at high list positions → `watch`,
  leave-on only, position-weighted.

---

## 4. Product score

```
deduction(ingredient) = tierDeduction × weight

  tierDeduction   = prohibited 100 · restricted 45 · caution 22 · watch 10 · clean 0
  weight          = 1 for prohibited/restricted   (legal signals: position-independent)
                  = label-order exposure for caution/watch
                    first INCI entry ≈ 1.0 → last entry ≈ 0.3
                    (INCI lists are descending concentration)

score = round( 100 − Σ deductions )           blended toward 78 when coverage < 1
```

**Coverage & confidence**

- `coverage = recognized / total`.
- `confidence`: `full` ≥ 0.9 · `partial` 0.6–0.9 · `limited` < 0.6.
- Incomplete lists are blended toward a *neutral* 78 (not toward 0, not toward
  100): an unrecognized name is unknown, not guilty and not innocent.
- Bands are additionally capped by confidence so a half-recognized list can
  never read "excellent": `limited` ≤ 64 (moderate at most), `partial` ≤ 84
  (good at most), `full` uncapped.

**Hard rules**

- Any recognized **EU-prohibited** ingredient → `score = min(score, 35)`,
  band `avoid`, `cappedReason: "prohibited-ingredient"`, error-level flag.
- 0 recognized ingredients → `score: null`, band `null`, `confidence:
  "limited"` (the caller must show "couldn't be analyzed", not a number).

**Bands**

| Band | Range | |
| --- | --- | --- |
| excellent | ≥ 85 | 🟢 |
| good | 70–84 | 🟢/🟡 |
| moderate | 55–69 | 🟡 |
| caution | 40–54 | 🟠 |
| avoid | < 40 | 🔴 |

### Worked examples (snapshot 2026-09-07, engine v1)

| INCI (condensed) | form | score / band | notes |
| --- | --- | --- | --- |
| Aqua, Glycerin, Niacinamide, Dimethicone, Phenoxyethanol | leave-on | 100 excellent | all recognized, no signals |
| Same + Parfum (tail) | leave-on | 93 excellent | warn `fragrance-generic` |
| Aqua, Alcohol Denat., Glycerin, Parfum, Linalool, Limonene, Tocopherol | leave-on | 56 moderate | drying alcohol + fragrance + 2 allergens |
| Body wash: Aqua, SLS, Cocamidopropyl Betaine, Glycerin, Parfum, Linalool, Limonene, Citric Acid | rinse-off | 78 good | allergens downgraded; sulfates not applicable rinse-off |
| Aqua, Glycerin, Hydroquinone, Cetearyl Alcohol | leave-on | 0 avoid | error `contains-prohibited` |
| Aqua, Cyclopentasiloxane, Retinol, Parfum | leave-on | 48 caution | restricted retinol + fragrance |
| Helichrysum extract, Xanthan, + 2 unrecognized | unknown | 64 moderate | `limited` coverage cap |

Reproduce any of them with
`npx tsx -e "import {analyzeInciText} from './src/lib/ingredient-safety/analyze'; console.log(JSON.stringify(analyzeInciText('…', {form:'leave-on'}), null, 1))"`.

---

## 5. Product form

The engine needs to know whether the product stays on skin (leave-on) or is
rinsed (rinse-off), because several signals are form-dependent:

- `leaveOnOnly` signals (comedogenicity, drying alcohol, sulfates) are
  **dropped** for rinse-off;
- allergens and leave-on-restricted preservatives (MIT, retinol…) **drop one
  tier** for rinse-off.

`form` can be passed explicitly or inferred from the OFF category/product
name (`inferProductForm`: shampoo/shower/wash/conditioner/… → rinse-off;
cream/lotion/serum/sunscreen/… → leave-on). Unknown → scored like **leave-on**
(the stricter EU thresholds), reported as `form: "unknown"`.

---

## 6. API

```
POST /api/inci/analyze
Content-Type: application/json

{
  "inciText": "Aqua, Glycerin, Niacinamide, Parfum, Linalool",
  // or "ingredients": ["Aqua", "Glycerin"],            (mutually exclusive)
  "form": "leave-on",        // optional: leave-on | rinse-off | unknown
  "label": "…",              // optional, echoed back
  "category": "Moisturizers" // optional, form hint
}
```

Response: the full `ProductAssessment` (see `src/lib/ingredient-safety/types.ts`):
per-ingredient rows with `matchedInci`, `cas`, `functions`, `signals`, `tier`,
`subScore`; product `score`, `band`, `confidence`, `flags`, `unknownIngredients`
and `dataset` freshness metadata. Guarded by Arcjet (when configured) + a per-IP
rate limit (60/min, shared/durable via Upstash when configured), like the other
public routes. `400` on bad input, `429` when rate-limited, `503` when the
local dataset is missing, `Cache-Control: no-store`.

Sizing limits: `inciText` ≤ 12,000 chars, `ingredients` ≤ 300 items.

---

## 7. Where this plugs into the app

The barcode flow already requests `ingredients_text` on every lookup (client +
server proxy — `product-lookup.ts`, `api/barcode/lookup`), and
`RemoteProductInfo.ingredientsText` carries it through `ProductResolution`
into the scan flow.

### 7.1 Getting the INCI list when Open Beauty Facts doesn't have it

OBF is crowd-sourced: many cosmetics resolve to a record with no transcribed
ingredient list (or no record at all). The scan flow now handles that with a
source ladder:

| # | Source | When | Needs |
| --- | --- | --- | --- |
| 1 | **OFF family, incl. `fr.openbeautyfacts.org`** | direct browser lookup (world food → MA food → world/fr beauty → world products). The French beauty mirror is the largest European cosmetics DB and covers the French brands common on Moroccan shelves. | nothing |
| 2 | **Vendor fill (barcode proxy)** | the app's `/api/barcode/lookup` proxy finds the product on a beauty mirror but it has no INCI text → asks the vendor for the list (only when `INCI_API_KEY` is configured; the client triggers it by calling the proxy once when a *direct* beauty hit lacked INCI). | optional key, server-only |
| 3 | **Vendor find** | no OFF-family mirror knows the code → the proxy asks the vendor for product name + INCI before giving up (last resort). | optional key, server-only |
| 4 | **Manual paste + memory** (`CoursesIngredientPanel`) | nothing above produced an INCI list → the pending-product card offers "paste from label". The text is analyzed fully locally and remembered **per barcode on this device** (localStorage overlay `smartjib_inci_overlay`) for repeat scans; once the scanned line is confirmed it is also saved **with the product in the account catalog** (`users/{uid}/products/{barcode}.ingredientsText`), so the list follows the account to other devices. | nothing — works offline |

Notes:
- **The vendor is only ever an INCI/name source.** The deterministic local
  engine (`/api/inci/analyze` + `eu-lists.ts` overlay) stays the single
  scoring authority, so results are consistent no matter which row of the
  ladder supplied the text.
- Enrichment is fail-open and bounded (3 s timeout, 8k-char cap, no key =
  zero vendor calls) and the client never sees the key — only the barcode
  digits go to the proxy, matching the app's privacy stance.
- **Analysis coverage fallback (same key, same rules).** `POST /api/inci/analyze`
  runs fully locally first. When `INCI_API_KEY` is set and some names
  stay unrecognized, the route asks the provider to analyze *only those names*
  (max 300) and adopts **only its `safe` verdicts** as clean-tier coverage —
  marked `vendorEnriched: true` in the response. Warnings, penalties, and
  `found:false` entries are dropped, so a third party can raise recognition
  coverage for genuinely safe newer ingredients but can never inject a penalty
  or override a verdict the local model already produced; any vendor failure
  returns the pure-local result unchanged. No key ⇒ the route never calls out.
- **Two-tier INCI memory.** The device-local overlay (`smartjib_inci_overlay`)
  is the offline/manual memory: writing happens only when a pasted list is
  submitted, it stays on the device, and the panel labels it "saved on this
  device" with a one-tap remove. The account-scoped copy is the product's
  `ingredientsText` field in Firestore, written only when a scanned line is
  **confirmed** (never while typing/scanning); it round-trips through the
  finance backup as an informational field (≤ 8,000 chars, no money
  semantics). The overlay keeps the device working offline and is the natural
  basis for an opt-in "share with Open Beauty Facts" contribution later.

**Shipped UI slice — the scan-time glance (Pro course flow):**
`CoursesIngredientGlance` renders inside the pending-product card whenever a
resolved product carries a full INCI list — from OBF, the vendor, or the
device memory after one manual paste. It shows the score chip + translated
band, recognition coverage, the top concern flags, and an expandable
per-ingredient tier list. Copy is composed locally from response *codes* and
message keys (`messages/*.json` → `ingredientGlance` / `ingredientManual`), so
server prose never leaks into the UI and all three locales (en/fr/ar) render
clean. The client (`src/lib/ingredient-analysis-client.ts`) caches results in
memory per INCI text (deterministic responses), so repeat scans of the same
product cost one call. The whole thing is inherently Pro-gated: it only
appears on the barcode scan path, which free plans never see.

Not built yet (deliberately): a standalone cosmetic-scanner screen
(barcode → OBF already works in the cascade, so it's a screen away),
per-product score persistence into the catalog/Firestore, label-photo OCR as
the paste step's successor (the repo already ships tesseract for receipts),
and any LLM-generated explanation. The engine's output is fully structured, so
longer explanation copy can be rendered deterministically from
`flags`/`signals` (auditable, localizable) — an LLM may later polish a
*cached* copy, never invent one.

---

## 8. Limits, disclaimers, roadmap

- **Freshness**: CosIng snapshot 2019-03-13 + identifier layer; overlay covers
  high-profile post-2019 changes but cannot be exhaustive. The overlay is
  versioned & dated in code, and refresh automation is the top roadmap item.
- **Name matching** is exact-ish by design; exotic spellings lower coverage.
  Natural-extract allergen names vary ("… Leaf Oil" vs "… Oil"); aliases cover
  the most common variants, and a missed variant shows up in
  `unknownIngredients`, not as a false flag.
- **No medical claims**: scores index EU regulatory status + published
  skin-science flags; they say nothing about efficacy, allergies of a given
  person, pregnancy safety, or non-EU (e.g. Moroccan) market legality.
- **Determinism**: same INCI → same JSON (unit-tested). If a future LLM layer
  is added, it must never change a score.
- **Disclaimers** belong next to every rendered score ("informational, not
  medical/legal advice; data as of the snapshot date shown in the response").

Reference documents: Regulation (EC) No 1223/2009 (consolidated,
EUR-Lex 02009R1223), its amendments (Reg (EU) 2021/1902, 2020/1682, 2024/996,
2023/1545, 1004/2014, 358/2014), EU CosIng database pages, Fulton et al. 1984,
Draelos & DiNardo 2006.
