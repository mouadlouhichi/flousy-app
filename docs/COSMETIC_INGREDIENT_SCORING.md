# Cosmetic label evidence analysis

**Implementation version:** `ingredient-evidence-v2`
**EU source date represented by the structured corpus:** 18 May 2026
**Purpose:** ingredient identity and source-attributed evidence, **not** a product-safety, medical, authorization, or legal-compliance verdict.

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

## Numeric output

A numeric **bounded evidence index** is available only when all of these hold:

- parser structure is valid;
- OCR text, if applicable, was reviewed;
- product form is known;
- regulatory applicability needed by matched signals is resolved;
- assessed-evidence coverage is at least 80%.

Otherwise `score` and `band` are `null`, with a machine-readable `scoreStatus`. Even when available, the index is not a safety rating or compliance determination. The UI does not use stars or “clean/safe product” language and always displays source date, product form, uncertainty, and the legal/medical caveat.

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
