# Cosmetic label evidence analysis

**Implementation version:** `ingredient-evidence-v4`
**EU source date represented by the structured corpus:** 18 May 2026
**Purpose:** ingredient identity and source-attributed evidence, **not** a product-safety, medical, authorization, or legal-compliance verdict.

`ingredient-evidence-v4` (2026-09-11) makes the index publishable for real products. Previous revisions withheld the numeric index whenever *any* EU condition was unresolved — which is every cosmetic containing a preservative, a UV filter or a colorant — so the score was withheld on 100% of realistic supermarket labels. The model now distinguishes an *unresolved condition* (published with a caveat) from a *withheld* result, treats positive-list entries as authorised-subject-to-conditions rather than restrictions, and aggregates deductions on a saturating curve so a worse label always ranks below a better one instead of everything saturating at 0. See `docs/RISK_BANK_PRODUCTION_AUDIT_2026-09-11.md` for the evidence and the parity work behind this change.

`ingredient-evidence-v3` (2026-09-09) added per-ingredient deduction transparency, a ranked "main risk drivers" UI, and a wider identity-alias table (common trade names plus French/Arabic label wording, every target verified against the dated glossary). Aliases establish identity only; regulatory status still comes exclusively from the structured annex corpus.

## Request path and privacy

Cosmetic text is submitted to the same-origin endpoint:

```text
POST /api/inci/analyze
```

The label photo used by OCR stays in the browser. The extracted text does not: after the user reviews and confirms it, the text is sent to this endpoint. If `INCI_API_KEY` is configured, only unidentified ingredient names may be sent by the server to the configured INCI evidence provider. Provider observations are attributed external evidence and cannot set a local tier or improve a score.

The server also records a bounded aggregate for unidentified names. It stores only a bounded token hash, count, dataset version, product-form bucket, and parser-validity bucket; it does not store the label, barcode, product name, account ID, IP, image, or raw ingredient token. Reporting is rate limited and best effort. Durable Firestore aggregation is enabled only when `UNKNOWN_INGREDIENT_HASH_KEY` supplies a deployment-specific HMAC key; otherwise the fallback is a bounded process-local aggregate, avoiding a dictionary-guessable durable digest.

OCR engine/worker assets are self-hosted. Selected Tesseract language data can be downloaded from the configured tessdata CDN on first use; the UI and privacy policy disclose this.

## Data layers

| Layer | Role | Source/version |
| --- | --- | --- |
| Official INCI glossary | Name identity only; never authorization or a positive safety finding | Commission Implementing Decision (EU) 2025/1175, 30,418 names |
| Legacy CosIng inventory metadata | Historical identity/function metadata | 13 March 2019 export |
| Structured cosmetics annex corpus | Annex entry, legal role, substance identity, conditions, effective/transition data and source references | Regulation 1223/2009 consolidated 18 May 2026 plus represented amendments, `eu-cosmetics-annexes-2026-05-26.json` |
| Curated non-regulatory signals | Narrow, explicitly labeled informational observations | versioned in source |
| Optional external provider | Attributed identity/evidence for unknown rows | current response; never scoring authority |

The generated files are:

- `data/cosing/eu-inci-glossary-2025.tsv`
- `data/cosing/eu-cosmetics-annexes-2026-05-26.json`

CosIng/glossary presence means only that a name was identified. It does not mean that an ingredient or formulation is permitted, compliant, suitable, effective, or safe.

## Parsing and OCR review

`parseInciList` retains Unicode letters and localized decimal digits. It:

- supports comma, semicolon, line, Arabic-comma, and Arabic-semicolon separators;
- joins likely wrapped ingredient lines;
- identifies ingredient headings and excludes later warning/net-weight sections with diagnostics;
- checks balanced `()`, `[]`, and `{}` delimiters;
- expands genuine nested ingredient lists such as `Parfum (Limonene, Linalool)`;
- never hides the suffix after an unmatched opener;
- emits diagnostics when sanitization excludes alphabetic text.

An invalid parse blocks numeric output. OCR always produces an editable draft. The user chooses the photographed label language independently of the interface language, reviews the full text and parsed rows, and explicitly confirms before analysis or persistence. OCR requests are bound to a product generation and are cancelled when that product changes. Images are size/dimension bounded and downscaled with grayscale/contrast preprocessing.

## Product form and applicability

Product form is `leave-on`, `rinse-off`, or `unknown`. Explicit phrases (for example, “leave-in conditioner” and “after-shave balm”) take precedence over generic words. French plurals and Arabic markers are supported. Every cosmetic panel exposes a form selector; choosing `unknown` deliberately withholds a numeric result.

Regulatory records preserve conditions rather than promoting any annex fragment found in free text to a universal result. Where concentration, product type, body site, age, professional use, warning, purity, combined exposure, or transition state cannot be resolved from a label, applicability is `conditions-unknown` and numeric output is withheld. An ingredient list cannot establish formulation-level compliance.

## Identity, evidence, and assessment are separate

Each row has independent fields for:

1. the raw and normalized label text;
2. identity status and identity source;
3. source-attributed signals/evidence;
4. applicability (`applies`, `does-not-apply`, or `conditions-unknown`);
5. assessment state;
6. an optional tier only when evidence supports one.

Important states include `identified-no-assessment`, `externally-identified`, and `unidentified`. None becomes `clean`, increases evidence coverage, or improves a numeric result merely because the name exists in an inventory or a provider recognized it.

## Score transparency (ranked drivers)

Every assessed row records `deduction` — the exact points its strongest supported signal removed from the 100-point index (regulatory signals carry full weight; curated signals are position-weighted, so wording earlier in the list weighs more). The scan UI uses it to rank up to three "main risk drivers" under the score banner: ingredient name, localized tier label, and the point cost. The ranking is rendered only when the numeric index itself is available; a withheld score never gets a driver breakdown.

## Risk-score presentation (product-owner direction, 2026-09-09)

The engine keeps the internal 0–100 index (100 = strongest clean evidence). **Every user-facing surface presents the inverse as a risk score** (`100 − index`): 0 = lowest listed risk, 100 = highest. A banner caption states the scale, and the band labels read as risk levels (Low risk → High risk). Stored assessments keep their engine semantics; the chips, ring, bill summary and glance all invert at display time so old and new records read consistently. The informational caveat ("not a product-safety or compliance verdict") remains on every panel.

## Numeric output

A numeric **bounded evidence index** is published when all of these hold:

- parser structure is valid;
- OCR text, if applicable, was reviewed;
- product form is known (explicit choice, or inferred from the product name/category);
- no matched EU **prohibited-list** (Annex II) record has an exception that cannot be resolved from the label;
- at least one row carries a listed signal **or** the dated corpus itself identified at least 90% of the rows (see “Clean labels” below);
- at least 60% of the rows are identified by the dated corpus (identity coverage, not signal coverage).

`scoreStatus` then reads either `available` or `available-with-unresolved-conditions`. The second is the ordinary case for a real cosmetic: Annexes III–VI carry concentration, product-type and warning conditions that an ingredient list cannot express. Those conditions stay unresolved — they are published as a mandatory caveat with `confidence` capped at `partial`, never silently treated as compliant.

Otherwise `score` and `band` are `null` with a machine-readable `scoreStatus`:

| Status | Meaning |
|---|---|
| `withheld-no-ingredients` | nothing was provided to analyze |
| `withheld-invalid-parse` | unbalanced/incomplete structure; the parsed rows need review |
| `withheld-review-required` | OCR draft not yet confirmed by the user |
| `withheld-form-unknown` | exposure context (leave-on/rinse-off) not chosen yet |
| `withheld-conditions-unknown` | an Annex II exception cannot be resolved from the label |
| `withheld-insufficient-evidence` | too few rows identified, or a list with no listed signal that the corpus only partly read |

### Clean labels

A fully read list on which nothing matched is a result, not a blank: every row
was checked against Annexes II–VI and the dated hazard overlays. When the
corpus **itself** (glossary or inventory, not an external provider) identifies
at least 90% of the rows and no row carries a signal, the index is published —
100 with band `excellent` — together with a mandatory `no-listed-signal` flag
and `confidence` capped at `partial`:

> No EU annex or dated hazard list mentions any ingredient here — that is not a
> certificate of harmlessness.

The 90% threshold is what makes absence publishable. On a partly read label the
rows we could not identify could hold the finding, so a zero-signal list below
that threshold stays withheld instead of displaying a clean number. Rows
identified only by an outside provider name lookup do not count towards the
threshold: a name is not a hazard assessment, and recognition must not be what
turns “nothing matched” into a published clean index.

This is the same discipline as the unresolved-conditions caveat, applied in the
other direction: the corpus says what it found, says what it did not find, and
never converts either into a claim about the product.

## How the index is computed

Per-row cost (`deduction`) is the point value of the row's strongest supported signal, with regulatory signals at full weight and curated/comfort signals position-weighted (earlier label wording weighs more):

| Tier | Points | Typical source |
|---|---:|---|
| `prohibited` | 100 | exact Annex II name match without an exception in the exported record |
| `restricted` | 30 | Annex III restriction entry; or a positive-list entry whose own wording excludes the selected product form |
| `caution` | 22 | curated signals (undeclared fragrance, formaldehyde releasers, EU fragrance allergens, published EU hazard assessments) |
| `watch` | 10 | positive-list entry (Annexes IV–VI) — an authorised substance whose conditions the label does not show |

Deductions are aggregated on a saturating curve, `index = 100 · e^(−Σ/100)`, so each additional signal removes a share of the *remaining* index. A plain sum saturated at 0 for any ordinary product (a preservative plus three declared fragrance allergens already exceeded 100 points), which made every imperfect product display the same worst-case number. The curve keeps the result strictly monotonic in the evidence while preserving the ranking.

Severity and coverage floors are applied afterwards, and the applied reason is reported as `cappedReason`:

- a `prohibited` row caps the index at 35;
- a `restricted` row caps it at 59 (a listed restriction may never be averaged into a clean result);
- identity coverage below 90% caps it at 94, below 70% at 79.

Even when available, the index is not a safety rating or compliance determination. The UI does not use stars or “clean/safe product” language and always displays source date, product form, uncertainty, and the legal/medical caveat.

## Positive-list form conflicts (resolved applicability)

Annexes IV–VI authorise a substance for named uses. When a record's own wording covers only the opposite exposure context from the one selected, the annex does not cover that use, and the engine resolves it as `applies` with a `restricted` tier and an explicit flag — for example methylisothiazolinone (Annex V/57 is rinse-off-only), so a leave-on declaration is not treated as an authorised use. This is resolution of the dated record's own wording, not a compliance verdict; a record that states no use context, or mentions both contexts, stays `conditions-unknown`.

## Published hazard assessments

A small curated table (see `src/lib/ingredient-safety/eu-lists.ts`) carries substances whose hazard character is stated by an EU body but whose dated annex entry reads as a neutral authorisation — currently triclosan, triclocarban, the isothiazolinones and benzophenone-3. Every entry is attributed (`kind: 'hazard-assessment'`, tier `caution` at most, never `prohibited`) and never duplicates what the annex corpus already expresses.

## Cache identity and cancellation

`ingredient-analysis-client.ts` keys completed and in-flight entries by normalized text, effective form, label, category, source/review state, and engine/dataset version. It is TTL- and size-bounded. Shared in-flight work has independent subscribers: cancelling one caller does not abort another caller still waiting for the same analysis. Components additionally bind completions to request/product identity.

## Product and historical persistence

A confirmed product can retain native GTIN, canonical GTIN-14, domain, cosmetic form, complete metadata, field provenance, retrieval/freshness data, allergens, and reviewed ingredient text. Device overlays are versioned and account-scoped; canonical GTIN-14 is the key. Legacy unscoped overlays are quarantined rather than assigned to the next signed-in account.

Shopping-line assessment writes are bound to `{sessionId, lineItemId, requestId, gtin14}`. The operation updates that origin even if the session was completed in the meantime, and refuses a mismatched/reused line. Historical lines retain the full immutable assessment response, exact tier counts, coverage, form, source versions/date, assessment timestamp, and deliberately withheld status.

Finance backup schema v2 accepts and restores all current product/session/assessment fields. Session restores participate in monotonic revision handling, and product restores merge so absent older fields do not erase richer destination metadata.

## Legal and product limits

- EU data is not Moroccan law.
- Annex restrictions commonly require facts absent from an INCI list.
- Product safety is formulation-level and includes exposure, impurities, stability, microbiology, packaging, and professional assessment.
- Ingredient order is not a concentration measurement.
- Personal allergy, sensitivity, pregnancy, age, medical history, and damaged skin are not modeled.
- Rules and transition dates change; the represented source date must remain visible and the conformance matrix must be reviewed whenever the corpus changes.

## Validation contracts

CI covers parser invariants, Unicode/Arabic labels, form request order, identity-versus-assessment behavior, current dated regulatory probes, exact GTIN boundaries, resolver cancellation/races, scanner generation/arming, origin-bound late assessments, outbox conflict behavior, account-scoped overlays, allergen context caching, and own-export backup fixed points. Physical-camera and real offline Firebase matrices remain release validation rather than unit-test substitutes.
