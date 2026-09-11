# Risk bank (ingredient risk) — production readiness audit

- **Audit date:** 2026-09-11
- **Feature:** the scan → ingredient-risk stack (`/api/inci/*`, `src/lib/ingredient-safety/*`, `src/lib/food-knowledge/*`, the Courses/Knowledge scan surfaces) — the Yuka/INCI-Beauty-style part of SmartJib
- **Question asked:** what is still missing before this can go live?
- **Baseline audited:** `d23ced6` (main, post PR #76)
- **Result:** **11 findings** — 2 release-blocking, 5 parity/UX, 3 calibration, 1 accepted risk. All blocking and parity findings are fixed in this revision; the remaining items are listed under [Still open](#7-still-open-before-and-after-go-live) with a recommendation each.

---

## 0. Headline

The feature was **not** production ready for two independent reasons, and neither is visible in CI:

1. **In production the API answered 503 for every request.** `/api/inci/analyze` reads two corpora from disk at runtime. `next.config.mjs` traced one of them (`cosing-ingredients.tsv`). The primary identity authority — `eu-inci-glossary-2025.tsv`, 30,418 official INCI names — was **not traced**, so `loadCosingDataset()` threw on the first request of every deployed instance and the route returned `dataset unavailable` for every scan. Local dev, `npm run check` and `npm run build` all passed: only a deployed build could show it.
2. **Even with the data present, the score was withheld on 100% of realistic products.** A probe of six real-world INCI lists (mass-market cream, shampoo, sunscreen, syndet bar, argan cream, hair mask) returned `score: null` on **6 of 6**. Two gates caused it: any unresolved EU condition blocked the index (every cosmetic has a preservative), and assessed-evidence coverage below 80% blocked it (a *good* product has no signals, so it could never be scored at all). The UI therefore showed — in production — a permanent "Risk score withheld" panel where Yuka and INCI Beauty show a number.

Both are fixed here, together with the parity gaps below.

---

## 1. Method

- Read the engine, the API routes, the client cache and every scan surface end to end.
- Ran executable probes against the real committed corpora: dataset load cost, realistic INCI labels (six products, leave-on and rinse-off), per-ingredient tier/deduction output, food labels, and the coverage/withheld matrix.
- Compared the surface against what Yuka and INCI Beauty actually ship (per-ingredient risk with an explanation, a product-level score, caveats for what a label cannot tell you, graceful offline/throttled behaviour, and a disclaimer that the output is not a safety verdict).
- Reviewed the deployment contract (file tracing, cold start, rate limits, error semantics).
- Re-ran the full gate: lint, both TypeScript checks, the data-verification script, 886 unit/integration tests, 65 render tests, and a production build.

Probes were run against the committed corpora (33,116 identity rows; 2,385 annex records), not fixtures.

---

## 2. Parity matrix — where the feature stands against Yuka / INCI Beauty

| Capability | Yuka | INCI Beauty | Before this revision | After this revision |
|---|---|---|---|---|
| Barcode scan → product | ✔ | ✔ | ✔ (OFF/OBF/OPF + MA seed) | ✔ unchanged |
| Cosmetic ingredient list → per-ingredient risk | ✔ | ✔ | ✔ (colour + tier) | ✔ **plus expandable per-ingredient detail** (identity source, CAS, functions, each signal, annex entry, max concentration, product type, warnings, sources) |
| Product-level score | ✔ | ✔ | ✖ **withheld on 6/6 real products** | ✔ published with caveats |
| Ranked "what drives the risk" | ✔ | ✔ | ✔ (drivers, only when scored) | ✔ (now nearly always meaningful) |
| "Why is this flagged?" explanation | ✔ | ✔ | ✖ flag text only | ✔ per-signal detail in the row |
| Distinguishes authorised-with-conditions from a restriction | partial | partial | ✖ **every preservative cost 45 pts as a "restriction"** | ✔ positive lists = `watch`, restrictions = `restricted`, resolved form conflicts flagged |
| Allergen / fragrance disclosure | ✔ | ✔ | ✔ | ✔ unchanged |
| Nutri-Score on food | ✔ | n/a | ✔ (ranking chip) | ✔ unchanged |
| NOVA / ultra-processing on food | ✔ | n/a | ✖ | ✖ — [recommended, not blocking](#7-still-open-before-and-after-go-live) |
| Works with no network | ✔ (cached) | ✖ | ✖ | ✖ but now **explained**: offline/429/5xx/timeout are distinct, actionable states with retry |
| Failure states are distinguishable | ✔ | ✔ | ✖ one generic "unavailable" | ✔ offline · rate-limited · service · timeout · invalid |
| Score cannot be mistaken for a safety verdict | ✔ | ✔ | ✔ | ✔ unchanged (caveat on every panel) |
| Shows what the source does not know | ✔ | ✔ | ✔ but as a hard block | ✔ as a caveat on a published score + reduced confidence |
| History / bill integration | ✔ | ✔ | ✔ | ✔ unchanged |

---

## 3. Findings

### F-01 — Release blocker — The EU glossary is not deployed, so the API 503s

**Evidence:** `next.config.mjs` `outputFileTracingIncludes` listed only `./data/cosing/cosing-ingredients.tsv`; `src/lib/ingredient-safety/dataset.ts` also opens `data/cosing/eu-inci-glossary-2025.tsv` (30,418 names, the primary identity authority) via `join(process.cwd(), …)`. Only traced files are deployed on Vercel/standalone.

**Impact:** every cosmetic scan in production would fail with `dataset unavailable`; the failure is invisible locally and in CI.

**Fix:**
- `next.config.mjs` now traces all three corpora the route can open.
- `scripts/verify-ingredient-data.mjs` (new) loads the datasets through the real loader, asserts minimum row counts, and fails if any runtime path is missing from the tracing list.
- Wired into `npm run check` (`verify:data`), so CI and local releases fail here instead of in production. A source-contract test asserts the same invariant inside `npm test`.

### F-02 — Release blocker — The score was withheld on every realistic product

**Evidence:** probe of six real INCI lists → `score: null` 6/6. Causes in `analyze.ts`:
- `hasUnknownConditions` withheld the index whenever *any* signal had `applicability === 'conditions-unknown'`. Every cosmetic contains at least one Annex V preservative, UV filter or colorant, so this was always true.
- `assessmentCoverage < 0.8` required 80% of **rows** to carry a **signal**, so a clean product (0 signals) could never be scored — the better the product, the blinder the app.
- `restricted` cost 45 points per row, so four declared fragrance allergens alone exceeded the whole index.

**Fix (engine `ingredient-evidence-v4`):**
- Withholding is reserved for the cases where a number would mislead: no ingredients, invalid/unreviewed parse, unknown product form, an **unresolvable Annex II exception**, or a list the corpus cannot read (identity coverage < 60%, or no row carries any signal).
- Ordinary unresolved conditions now publish the score with `scoreStatus: 'available-with-unresolved-conditions'`, a mandatory UI caveat, and `confidence` capped at `partial`.
- `restricted` is 30 points (was 45); positive-list entries are `watch` (10) — see F-03.
- Deductions aggregate on a saturating curve `index = 100·e^(−Σ/100)` so worse labels rank strictly lower instead of all clamping to 0.
- Coverage/severity floors (94 / 79 / 59 / 35) and the applied `cappedReason` keep an incomplete or restricted list from reading as clean.

**Verification:** `tests/ingredient-safety.test.ts` → "production scoring readiness" suite: six realistic labels now all score, the parabens+allergen cream ranks below the simple cream, and the index stays monotonic as signals are added.

### F-03 — High — Authorised ingredients were scored as restrictions

**Evidence:** Annexes IV–VI (colorants, preservatives, UV filters) are *positive lists*: the substance is authorised subject to conditions. `regulatory.ts` gave every such entry tier `restricted` (45 pts), so phenoxyethanol — an authorised preservative at ≤1% — cost the same as an Annex III restriction and more than undeclared "Parfum" (22 pts).

**Fix:** positive-list entries are `watch` with the label "authorised substance, conditions not shown on the label". The one exception is a **resolved form conflict**: when the annex record's own wording covers only the opposite exposure context (methylisothiazolinone's Annex V/57 entry is rinse-off-only), the row resolves to `applies`/`restricted` with an explicit flag. Records that state no use context stay unresolved.

### F-04 — High — No per-ingredient detail (the INCI-Beauty core)

**Evidence:** the ingredient list showed a name, a tier pill and the raw label text; nothing explained *why*. Yuka and INCI Beauty are both built around tapping an ingredient and reading the reason.

**Fix:** each row expands to identity source + glossary entry, CAS, cosmetic functions, and every signal with its label, detail, annex entry, applicability, max concentration, product type/use, required warnings and source citations, plus any attributed external observation. Copy is composed from response codes and localized in `en`/`fr`/`ar`; no server prose is rendered.

### F-05 — High — Every failure looked the same and none could be retried

**Evidence:** the client threw a generic `Error`, the UI rendered one static "Ingredient check unavailable" string, and no surface offered a retry. Offline (the normal supermarket state), 429 and 503 were indistinguishable.

**Fix:** `IngredientAnalysisError` with `kind: offline | rate-limited | service | timeout | invalid | network`; the client fails fast when `navigator.onLine === false` instead of spending a request; the glance and the label accordion render kind-specific copy and a retry action (hidden for `invalid`); a failed request is dropped from the in-flight map immediately so a retry always issues a fresh request inside the cache TTL.

### F-06 — High — Product-form inference was too narrow, silently blocking the score

**Evidence:** `inferProductForm` matched a short pattern list, so ordinary names/categories ("Face wash", "Gel douche", شامبو بالأرغان with no category) produced `unknown`, which withholds the index.

**Fix:** three-tier inference — strong rinse-off wording first (so "face wash" is not captured by the broad leave-on word "face"), then leave-on wording, then weak rinse-off wording — with French and Arabic coverage for the Moroccan shelf ("شامبو", "صابون", "كريم مرطب", "Gels douche", "Soins du visage"). Explicit user choice still wins, and the withheld state now tells the user to choose instead of just saying "withheld".

### F-07 — Medium — No way to publish a number *with* an unresolved condition

**Evidence:** `ScoreStatus` had no state between "available" and "withheld", so the honest middle — score published, caveat attached — could not be expressed; that is why F-02 was implemented as a blanket block.

**Fix:** new `available-with-unresolved-conditions` status (accepted by `finance-backup.ts` restore validation, so historical records round-trip), a caveat block under the score banner, `confidence` capped at `partial`, and a `regulatory-conditions-unknown` flag.

### F-08 — Medium — Rate limits assumed one user per IP

**Evidence:** `/api/inci/analyze`, `/api/inci/lookup`, `/api/food/analyze` and `/api/barcode/lookup` allowed 60 requests/minute **per IP**. Mobile carriers in the target market share one public IP across many subscribers (CGNAT), so a busy cell tower produced 429s for shoppers doing nothing unusual.

**Fix:** 180/min for the analysis routes and 120/min for the lookup routes, with the rationale recorded in each route. The work per request is small (in-memory corpora, ~1–4 ms steady state) and the browser cache already dedupes repeats for 10 minutes, so the higher ceiling costs little. `Retry-After` is unchanged.

### F-09 — Medium — The index saturated, destroying the ranking

**Evidence:** with `restricted` at 45 points and no decay, a cream with four declared fragrance allergens and two preservatives produced a deduction ≥100, i.e. index 0 — identical to a far worse product.

**Fix:** saturating aggregation (see F-02) plus severity floors. Sample output now: argan cream 84 · sunscreen 57 · syndet bar 47 · hair mask 36 · parabens cream 22 · shampoo 21 (engine index; higher = fewer listed signals). The UI inverts this to a 0–100 risk score.

### F-10 — Medium — Well-documented hazards looked like ordinary authorised ingredients

**Evidence:** methylisothiazolinone, triclosan, triclocarban and benzophenone-3 have published EU hazard assessments but only conditional authorisations in the annex corpus, so they read as neutral positive-list rows.

**Fix:** a deliberately small, attributed curated table (`kind: 'hazard-assessment'`, tier `caution`, never `prohibited`) in `eu-lists.ts`, covering those four substances, with the EU body and the annex entry cited. It never duplicates what the annex corpus already states, and it never becomes a compliance verdict.

### F-11 — Accepted — Cold start is ~0.5 s per serverless instance

**Measurement:** identity corpora load in ≈470 ms (33,116 rows, ~40 MB heap), the annex index in ≈15 ms, first analysis ≈4 ms, steady state 1–4 ms.

**Decision:** accepted. The corpora are loaded once per instance and cached in module scope; the cost is a cold-start penalty only, well inside the 10 s client timeout. If launch traffic makes this visible, the mitigation is a scheduled warm-up or moving the corpora to a warmed service — not shipping a smaller corpus, which would lower identity coverage.

---

## 4. What changed

| Area | File |
|---|---|
| Scoring model, withholding rules, caps, saturating aggregation, form-conflict flag | `src/lib/ingredient-safety/analyze.ts` |
| Positive-list tier + resolved form conflicts | `src/lib/ingredient-safety/regulatory.ts` |
| New score status and hazard-assessment evidence kind | `src/lib/ingredient-safety/types.ts` |
| Published hazard assessments | `src/lib/ingredient-safety/eu-lists.ts` |
| Engine/data version bump (invalidates client caches) | `src/lib/ingredient-safety/version.ts` |
| Product-form inference | `src/lib/ingredient-safety/form.ts` |
| Typed failures, offline fast-fail, in-flight cleanup | `src/lib/ingredient-analysis-client.ts` |
| Caveat block, retry, withheld reasons, per-ingredient detail | `src/components/dashboard/courses/courses-ingredient-glance.tsx` |
| Accordion failure copy | `src/components/dashboard/courses/courses-label-accordion.tsx` |
| Restore validation for the new status | `src/lib/finance-backup.ts` |
| Rate limits | `src/app/api/{inci/analyze,inci/lookup,food/analyze,barcode/lookup}/route.ts` |
| Deployment tracing | `next.config.mjs` |
| Release guard | `scripts/verify-ingredient-data.mjs`, `package.json` (`verify:data`, wired into `check`) |
| Copy for the new states (en/fr/ar) | `messages/*.json` |
| Regression + source-contract tests | `tests/ingredient-safety.test.ts`, `tests/ingredient-analysis-client.test.ts`, `tests/render/ingredient-glance.test.tsx` |
| Methodology | `docs/COSMETIC_INGREDIENT_SCORING.md` |

---

## 5. Validation

- `npm run lint` — clean.
- `npm run typecheck` and `npm run typecheck:strict` — clean.
- `npm run verify:data` — datasets load at expected size and every runtime path is traced.
- `npm test` — 886 unit/integration + 65 render tests pass, including six new production-readiness tests and the tracing source contract.
- `npm run build` — all static pages generated.

Test coverage added for the findings above:

- realistic labels publish an index and rank correctly (F-02, F-03, F-09);
- positive-list vs restriction vs prohibited tiers and their ordering (F-03);
- coverage caps and monotonicity (F-09);
- unresolved conditions publish with a caveat, unresolved Annex II exceptions still withhold (F-02, F-07);
- methylisothiazolinone form conflict and hazard assessment (F-03, F-10);
- failure kinds mapped from HTTP 429/5xx, network and offline states, plus retry (F-05);
- form inference for wash-off vs leave-on and local-language wording (F-06);
- tracing contract (F-01).

---

## 6. Assurance boundaries

Unchanged by this revision, and still true:

1. An ingredient list cannot establish formulation safety or legal compliance: concentration, exposure, impurities, warnings, professional use and transition facts may be absent.
2. Morocco and the EU are distinct jurisdictions. EU source status is shown as EU context, never as a determination of Moroccan law.
3. CosIng/glossary presence means a name was identified — nothing about authorisation, compliance, suitability or safety.
4. A dated, independently reviewed legal conformance matrix should be re-checked whenever the annex corpus changes (last corpus date represented: 18 May 2026).

---

## 7. Still open (before and after go-live)

| # | Item | Why it is not blocking | Recommendation |
|---|---|---|---|
| 1 | **NOVA / ultra-processing on food** | Yuka shows it; our food panel already shows Nutri-Score, allergens, additives and a label-vagueness breakdown, so the food surface is useful without it | Add `nova_group` to the Open Food Facts fields, persist it on the product document (Firestore rules allowlist), and render a chip. Medium effort, no engine change |
| 2 | **Offline scoring** | Yuka scores on-device; ours needs the network. Both surfaces now explain the state and offer retry, so the failure is legible rather than silent | If offline scanning becomes a requirement, ship a bounded on-device corpus (identity + tiers only) for the top ~2,000 cosmetic ingredients and score locally |
| 3 | **Identity-coverage telemetry** | The unknown-ingredient aggregate exists but is not dashboarded | Publish a weekly count of `unidentified` rows per dataset version and use it to prioritise alias work; this is the main driver of user-visible "not recognized" chips |
| 4 | **Real-device camera validation** | CI covers deterministic lifecycle and browser-fake contracts, not camera drivers | Keep the release checklist item: Android Chrome + iOS Safari, low light, damaged/creased labels |
| 5 | **Better alternatives / product recommendations** | Not offered by INCI Beauty either | Only meaningful with a product search index; defer |
| 6 | **Local Moroccan cosmetic coverage** | The MA seed covers food; cosmetics resolve through OBF/OPF | Extend the seed with Moroccan personal-care barcodes once scan telemetry shows the misses |
