# Scan and ingredient-risk functional audit

- **Audit date:** 2026-09-08
- **Audited revision:** `eb588a3`
- **Remediation update:** 2026-09-09
- **Remediated revision:** `406f003` on PR [#67](https://github.com/mouadlouhichi/flousy-app/pull/67)
- **Scope:** barcode acquisition and every scan surface; product resolution and persistence; cosmetic INCI acquisition, parsing, scoring, caching, display, and history
- **Original release recommendation:** **do not present the audited cosmetic score as a reliable safety or EU-regulatory verdict until A-01 through A-04 are fixed.** The audited shopping scanner also needed a one-scan/one-action state machine.
- **Current implementation status:** the code remediations for A-01 through A-20 are implemented and regression-covered. Ingredient output remains an informational, EU-source-based label assessment—not a product-safety opinion, medical recommendation, or determination of legal compliance.

> **Historical-reading note:** Sections 1–8 preserve the evidence and behavior observed at `eb588a3`. Present-tense statements in those sections describe the audited revision, not `406f003`. Section 0 records the implemented closure and current validation state.

## 0. Remediation status (2026-09-09)

### Closure summary

| Finding | Status at `406f003` | Implemented evidence |
|---|---|---|
| **A-01** — current regulatory classifications | **Implemented with claim gates** | Versioned 30,418-name EU glossary plus a 2,385-record condition-preserving Annex II–VI corpus; applicability is explicit and scoring is withheld when conditions cannot be resolved (`data/cosing/`, `src/lib/ingredient-safety/{dataset,regulatory,analyze}.ts`). |
| **A-02** — parser/OCR suffix loss | **Implemented** | Unicode-aware parsing, delimiter diagnostics, no silent alphabetic-suffix loss, bounded OCR, and mandatory review of OCR text and parsed tokens (`normalize.ts`, `label-ocr.ts`, `label-ocr-button.tsx`). |
| **A-03** — cache/form context | **Implemented** | Explicit and user-correctable form; completed and in-flight identity includes normalized text, effective context, review source, and engine/dataset version (`form.ts`, `ingredient-analysis-client.ts`). |
| **A-04** — recognition promoted to “clean” | **Implemented** | Identification, local evidence, external provenance, and assessment are separate; provider observations are attributed and cannot create a local tier, clear a concern, or improve a score (`analyze.ts`, `server/vendor-inci.ts`). |
| **A-05** — repeat/stale scan actions | **Implemented** | One-acquisition/one-action lifecycle, synchronous acceptance gate, explicit rearm, generation checks, and stale detector suppression (`use-barcode-scanner.ts`, `scanner-lifecycle.ts`). |
| **A-06** — barcode mutation/format loss | **Implemented** | Shared format-aware GTIN-8/12/13/14 validation, explicit UPC-E expansion, checksum enforcement, and canonical zero-filled GTIN-14 identity across all boundaries (`gtin.ts`). |
| **A-07** — divergent lookup consumers | **Implemented** | Courses, Knowledge, and Expense use the same abortable `resolveScan` orchestration and origin-aware result contract (`scan-resolution.ts`, `product-lookup.ts`). |
| **A-08** — binary domain routing | **Implemented** | Food/cosmetic/household/pet/unknown domain model with explicit user selection/override and conservative inference (`food-knowledge/domain.ts`, Courses and Knowledge screens). |
| **A-09** — lossy catalog learning | **Implemented** | Complete bounded product metadata, per-field provenance, canonical identity, merge semantics, and stale-while-revalidate refresh (`course-session.ts`, `product-lookup.ts`). |
| **A-10** — non-durable last-write-wins shopping state | **Implemented** | Durable local state, revisioned mutation outbox, transaction/rebase behavior, bounded retention, and synchronized persistence (`use-course-session.ts`, `course-sync.ts`, `db.ts`). |
| **A-11** — OCR language/stale lifecycle | **Implemented** | Label-language selector independent of UI locale, self-hosted models, acquisition identity, abort handling, bounded preprocessing/output, and mandatory confirmation (`label-ocr.ts`, `label-ocr-button.tsx`). |
| **A-12** — lossy quality/history/restore | **Implemented** | Origin-bound asynchronous assessment writes, full evidence/version/coverage snapshots, strict nested restore validation, and export→restore→export fixed points (`course-sync.ts`, `finance-backup.ts`). |
| **A-13** — prefix price/origin overstatement | **Implemented** | Restricted-circulation price parsing requires an explicit issuer layout and confirmation; GS1 prefix copy no longer claims manufacturing origin (`course-session.ts`, `scan-resolution.ts`, localized copy). |
| **A-14** — privacy/methodology mismatch | **Implemented** | README, privacy text, environment documentation, localized copy, provider fields/recipients, on-device OCR, sync timing, and methodology now match execution (`README.md`, `.env.example`, `docs/COSMETIC_INGREDIENT_SCORING.md`). |
| **A-15** — inactive ROI/zoom/coarse errors | **Implemented** | Real track zoom capability handling, ROI-aware decoding, camera recovery/restart states, and differentiated media errors (`use-barcode-scanner.ts`, `barcode-scanner-panel.tsx`). |
| **A-16** — serial lookup starvation | **Implemented** | One end-to-end deadline and cancellation signal with bounded parallel source resolution; provider time is inside the shared budget (`scan-resolution.ts`, barcode lookup route). |
| **A-17** — Nutri-Score points shown as `/100` | **Implemented** | Only real grades are ranked; calculation points retain their actual direction/semantics and are not rendered as a positive percentage (`product-lookup.ts`, `ranking-chip.tsx`). |
| **A-18** — device-overlay lifecycle/account leakage | **Implemented** | Account-scoped synchronized overlays, canonical GTIN identity, corruption rejection, 12,000-character/300-entry bounds, precedence, removal, and bounded adoption (`ingredient-device-store.ts`). |
| **A-19** — food cache/context/allergen gaps | **Implemented** | Context-complete bounded cache and in-flight identity, immediate deterministic local output, independent subscriber cancellation, asynchronous enrichment, and trusted OFF allergen-tag plumbing (`food-analysis-client.ts`, food panels). |
| **A-20** — missing/defect-encoding tests | **Implemented** | Boundary, current-law, GTIN, request-order, cancellation, OCR, origin-write, multi-tab/outbox, restore, hostile-provider, Firestore Rules, render, and browser lifecycle coverage under `tests/`. |

Cross-cutting additions requested with the remediation are also present:

- Local identity coverage now uses the official 30,418-name EU 2025 glossary with aliases and legacy metadata where useful. A recognized name establishes nomenclature identity only; it does **not** establish safety, authorization, or compliance.
- Unidentified ingredients are reported through a privacy-minimized, bounded, rate-limited aggregate. No raw token, label, barcode, product name, account ID, image, or IP identity is stored; durable reporting requires a deployment-specific HMAC key.
- The shared 12,000-character label-text ceiling is enforced at UI, OCR, client-cache, API, external-provider, analysis-core, catalog, persistence, and backup boundaries. Oversized consequential values are rejected whole instead of prefix-truncated.

### Validation at the remediated revision

- `npm run check` passed locally on 2026-09-09: lint, normal and strict TypeScript checks, **798 unit/integration tests**, and **59 render tests**, with zero failures.
- `npm run build` passed and generated all 55 static pages.
- GitHub Actions run [`34287229448`](https://github.com/mouadlouhichi/flousy-app/actions/runs/34287229448) passed `check`, the Firestore emulator Rules suite, production build, and browser `e2e`.
- Vercel preview checks on the documentation pushes have alternated between a successful preview and the account build-rate-limit status. The rate-limit result is an account constraint, not a source/build failure; local and GitHub Actions production builds pass.

### Assurance boundaries that remain

Implementation closure is not the same as regulatory certification or physical-device certification:

1. An independently reviewed, dated legal conformance matrix should remain part of release governance whenever the regulatory corpus changes.
2. Real-device camera behavior should continue to be checked on representative Android Chrome and iOS Safari devices; CI covers deterministic lifecycle and browser-fake contracts, not every camera driver.
3. An ingredient list cannot establish formulation safety or legal compliance because concentration, product use, exposure, impurities, warnings, and transition facts may be absent. The implementation therefore withholds conclusions when required applicability is unresolved.
4. Morocco and the EU are distinct jurisdictions. EU source status is displayed as EU context and is not presented as a determination of Moroccan law.

## 1. Executive summary (audited revision `eb588a3`)

The implementation has a thoughtful fallback structure, good localization coverage in many rendered components, explicit timeouts, bounded server caches, manual-entry paths, and useful pure-function test coverage. `npm run check` and `npm run build` both pass at the audited revision. Those checks do not exercise the request-identity, camera lifecycle, multi-tab, OCR-quality, or regulatory-freshness failures below.

The audit found **20 prioritized issues**:

- **4 critical**: incorrect current regulatory outcomes, parser-driven false reassurance, context-unsafe score caching/form inference, and treating inventory/vendor recognition as proof of “clean”.
- **10 high**: repeated/stale scans, barcode corruption and unsupported valid GTIN forms, stale lookup surfaces, binary domain routing, lossy catalog learning, non-durable/concurrent persistence, OCR lifecycle/language defects, lossy history/backup, issuer-independent variable-price parsing/origin claims, and inaccurate privacy/methodology claims.
- **6 medium**: cosmetic zoom/ROI and permission handling, lookup deadline ordering, raw Nutri-Score rendering, device-overlay lifecycle, food-analysis caching/plumbing, and test gaps.

The most important reproduced outcomes are:

1. A valid EAN-8, `96385074`, fails checksum validation; invalid `96385078` passes and is committed as the “valid” test fixture.
2. Checksum warnings are ignored, so a corrupt code is still looked up and can be persisted.
3. Holding a barcode in view can emit it again every 700 ms. Pending data can be reset/replaced; after confirmation the same stationary barcode can increase quantity.
4. `Aqua, Glycerin (plant derived, Sodium Laureth Sulfate, Parfum` is parsed as two recognized clean ingredients and returns **100 / Excellent**, hiding everything after the unmatched parenthesis.
5. An all-unknown ingredient can change from **no score** to **100 / Excellent** solely because an optional vendor reports it as “safe”.
6. The same INCI text can return a cached rinse-off result in a leave-on context. For methylisothiazolinone, the uncached engine produces **55 / Moderate** for leave-on and **97 / Excellent** for rinse-off.
7. Current-law probes produce both directions of regulatory error: Quaternium-15, 4-MBC, and TPO can appear reassuring, while Triclosan, Triclocarban, and DINP are labeled universally prohibited.
8. A backup exported by this build includes modern scan metadata, but this build's own reader removes product `ranking`/`beauty` and session-item `ranking`/`quality` before restore.

## 2. Original audit method and confidence

### What was exercised

- Traced camera/native `BarcodeDetector`, ZXing, keyboard-wedge, and manual input through every consumer.
- Traced Courses, Ingredient Knowledge, and Expense scan flows through normalization, lookup, pending state, repeat scans, catalog writes, session writes, history, and backup/restore.
- Ran focused executable probes against barcode normalization, product resolution, INCI splitting, risk scoring, client caches, form inference, domain detection, and backup parsing.
- Reviewed the committed CosIng source/provenance, overlay, API routes, client caches, Firebase setup, Firestore writes/rules, and localized copy.
- Compared current regulatory outputs with the EU Cosmetics Regulation consolidation current to **18 May 2026** and relevant amendments through the audit date.
- Ran the repository's full lint, normal and strict TypeScript checks, unit/render tests, and production build.

### Confidence labels used below

- **Confirmed/reproduced:** deterministic output was executed or the behavior follows directly from a synchronous code path.
- **Code-path confirmed:** the race/lifecycle defect is present in code, but its frequency still needs a physical-device or multi-tab matrix.
- **Design limitation:** no single line is necessarily broken; the model lacks information needed to support the claim the UI makes.

No physical camera was available in the audit environment. Camera timing findings are therefore code-path confirmed; pure parsing, scoring, barcode, cache, and backup findings are reproduced.

## 3. Surface map (audited revision `eb588a3`)

| Surface | Capture | Canonicalization | Resolution | Confirmation | Persistence |
|---|---|---|---|---|---|
| **Courses** | Native detector, ZXing, hardware wedge, shared manual field | `normalizeBarcode` | catalog → prefix-2 interpretation → Moroccan seed → direct/proxy OFF family → manual | pending product + quantity + price | full session document + learned product; quality added asynchronously |
| **Ingredient Knowledge** | Same scanner, plus a second manual barcode form | `normalizeBarcode` | deliberately passes `catalog: []`, then prefix-2/seed/remote | product card; optional “Save product” | optional product write, but subsequent Knowledge scans do not consume that catalog |
| **Expense** | Same scanner and manual field | **none before lookup** | `lookupOffProduct` only | “Use this product” | only `brand – name` is copied into the expense name; barcode and all product metadata are discarded |
| **Cosmetic label** | OFF/OBF text → optional barcode vendor → device overlay → paste/OCR | `splitInciList` + ASCII-centric normalization | local 2019 CosIng-derived snapshot + hand overlay + optional safe-only vendor recognition | score is shown as soon as text is accepted | ingredient text can enter device overlay and account catalog; a reduced quality summary enters the session later |
| **Food label** | OFF text or paste/OCR | food parser | local rules + optional external explanation | panel only | analysis is not stored; OFF allergen tags are not plumbed from lookup |

## 4. Prioritized confirmed findings (audited revision `eb588a3`)

### A-01 — Critical — Current EU regulatory classifications are materially wrong

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed/reproduced
**Primary evidence:** `data/cosing/README.md`; `src/lib/ingredient-safety/eu-lists.ts:80-207`; `src/lib/ingredient-safety/dataset.ts:18-25,83-129`; `src/lib/ingredient-safety/analyze.ts:160-257`

The base functions/restrictions snapshot is dated **2019-03-13**. A hand-maintained overlay claims post-2019 coverage but contains incorrect entries, omits effective amendments, and even carries a placeholder citation (`02009R1223-2025xxxx`). The restriction parser then treats the presence of any `II/...` fragment as a universal prohibition and any `III/...` fragment as a universal restriction, without parsing product type, concentration, professional use, exceptions, or transition dates.

Reproduced with `Aqua, <ingredient>`:

| Ingredient/context | App result | Current regulatory problem |
|---|---:|---|
| Triclosan, leave-on | prohibited, **0 / Avoid** | Regulation (EU) 2024/996 retains specified permitted uses/concentrations; it is not universally prohibited. |
| Triclocarban, rinse-off | prohibited, **0 / Avoid** | 2024/996 retains conditional preservative/other rinse-off uses. |
| Diisononyl Phthalate (DINP) | prohibited, **0 / Avoid** | The blanket overlay entry is not supported by the current Cosmetics Annex II review. Separate REACH restrictions are not a universal cosmetics ban. This is not a finding that DINP is universally “safe”. |
| Quaternium-15 | caution, **93 / Excellent** | Regulation (EU) 2019/831 removed it from Annex V and added it to Annex II. |
| 4-Methylbenzylidene Camphor | clean, **100 / Excellent** | 2024/996 added it to Annex II; the market transition ended 1 May 2026. |
| Trimethylbenzoyl Diphenylphosphine Oxide (TPO) | clean, **100 / Excellent** | Regulation (EU) 2025/877 added it to Annex II from 1 September 2025. |
| Retinol, rinse-off | watch, **97 / Excellent** | 2024/996 restricts vitamin A in both leave-on and rinse-off products; the app incorrectly treats its rule as leave-on-only. |
| Genistein, Daidzein, Kojic Acid, Alpha-Arbutin, Arbutin | clean, **100 / Excellent** | 2024/996 introduced product/concentration restrictions for all five. |

The generic Annex parser also produced “prohibited” for records carrying mixed contextual references such as `CI 42510` (`IV/66 [III/256] II/1329 as hair dye`) and `Cuminum Cyminum Fruit Oil` (`II/358 R1 III/156`). Finding an Annex II token inside a free-text restriction is not enough to claim that every occurrence of the INCI name is prohibited in every product.

**Impact:** both false reassurance and false prohibition are shown with emphatic bands, stars, `100/100`, “Excellent”, or “Avoid”. This is the highest-risk defect in the audited feature.

**Required remediation:** immediately suppress legal-status language and the numeric score while the corpus is repaired. Replace hand-authored blanket names with a versioned structured source tied to legal entry, substance identity/CAS, product type, maximum concentration, warnings, transition dates, and effective date. Add an independently reviewed current-law conformance matrix to CI. Never infer compliance from an ingredient list when concentration or intended use is missing.

---

### A-02 — Critical — Parsing and automatic OCR acceptance can hide hazardous ingredients while returning a reassuring score

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed/reproduced
**Primary evidence:** `src/lib/ingredient-safety/normalize.ts:12-58,108-149`; `src/components/dashboard/courses/courses-ingredient-panel.tsx:151-169,261-275`; `src/components/dashboard/courses/label-ocr-button.tsx:28-46`

`splitInciList` suppresses separators while bracket depth is non-zero; `normalizeWithoutParens` then removes everything from an unmatched opener onward. The remaining benign prefix can match a dataset row and be scored as the whole token. Parenthetical sub-lists are also kept as one token and then stripped for matching, so listed fragrance allergens inside them are not independently assessed.

Reproduced cases:

| Input | Parsed/evaluated outcome |
|---|---|
| `Aqua, Glycerin (plant derived, Sodium Laureth Sulfate, Parfum` | Two recognized ingredients (`Aqua`, `Glycerin`), **100 / Excellent**; SLES and Parfum disappear. |
| `Aqua, Parfum (Limonene, Linalool)` | The parenthetical allergens are not assessed; only generic Parfum is seen, **93 / Excellent**. |
| `Aqua, Sodium Laureth\nSulfate, Glycerin` | Wrapped ingredient is split into `Sodium Laureth` and `Sulfate`, both unknown. |
| Full-photo OCR containing headings and net weight | Headings/marketing/net quantity become ingredients; a leading `INGREDIENTS:` heading is only removed if it starts the entire OCR text. |
| `ماء، جلسرين، عطر` | Zero tokens: normalization retains only ASCII `A-Z` for matching/validation. |

The OCR path auto-adopts any output for which the permissive splitter returns at least one token; it does not require the user to confirm the crop, text, balanced delimiters, or parsed ingredient rows first.

**Impact:** ordinary OCR punctuation loss or wrapped labels can remove exactly the tail that contains preservatives, fragrance, colorants, or warnings, while the UI shows a high-confidence positive score.

**Required remediation:** treat OCR as untrusted draft data. Require review of the extracted text and parsed token list before analysis; reject or prominently block scoring on unbalanced brackets; distinguish annotations from nested ingredient lists; join likely wrapped lines; retain Unicode; and never silently discard a suffix. Add parser invariants such as “sanitization may not remove alphabetic spans without a warning”.

---

### A-03 — Critical — Score cache and form inference can return the wrong assessment for the current product

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed/reproduced
**Primary evidence:** `src/lib/ingredient-analysis-client.ts:27-37,61-91`; `src/components/dashboard/courses/courses-label-accordion.tsx:148-173`; `src/lib/ingredient-safety/analyze.ts:65-105,313-324`

The cosmetic client cache key contains only normalized ingredient text. It omits `form`, product label, category, dataset/engine version, and vendor provenance. A probe made two requests for the same text with different contexts: only one HTTP call occurred and the second caller received the first result object and first label/form.

This changes safety output, not just metadata. The uncached engine returns:

- `Aqua, Methylisothiazolinone` as leave-on: **55 / Moderate**, restricted.
- The same text as rinse-off: **97 / Excellent**, watch.

Whichever context populates the ten-minute cache first wins. The accordion adds another stale guard: `requestedCosmeticRef` is keyed only by text, so a different product with the same list or a changed category does not re-run analysis.

Form inference itself is substring/order based and has reproduced misclassifications:

- “After shave balm” → rinse-off because `shave` is checked before `balm`.
- “Leave-in conditioner” → rinse-off because `conditioner` wins.
- French `Shampoings` and `Savons`, plus Arabic shampoo/cream labels → unknown (internally scored as leave-on).

There is no form override in the UI even though the API supports one.

**Impact:** the displayed and persisted score can depend on navigation/request order rather than the current product. Restrictions can be downgraded, and history can preserve the wrong context.

**Required remediation:** make product form explicit and user-correctable; derive it once per product; key completed and in-flight caches by normalized text + effective form + relevant context + engine/dataset version; reset component request identity on barcode/context changes; and test both request orders.

---

### A-04 — Critical — “Recognized” is incorrectly promoted to “clean”, and a vendor can manufacture 100 / Excellent

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed/reproduced
**Primary evidence:** `src/lib/ingredient-safety/analyze.ts:251-278,324-362`; `src/lib/server/vendor-inci.ts:271-356`; `src/app/api/inci/analyze/route.ts:112-139`

Any row found in the merged inventory gets tier `clean` when no negative overlay is attached. That includes roughly 2,700 identifier-layer names added without current official restriction/function data. CosIng itself states that presence in the database does not constitute authorization, yet the UI turns inventory identity into a green safety statement.

The optional vendor path is one-sided: only a vendor “safe” result is accepted, as `clean`; every concern/unsafe result is ignored rather than represented. A reproduced all-unknown input changed from:

- local: `recognized: 0`, `score: null`
- vendor-recognized: `recognized: 1`, `score: 100`, `band: excellent`, `tier: clean`

Consequently configuration, quota, latency, or network state can change the same label from “cannot score” to “Excellent”. `vendorEnriched` is not shown to the user, and the client cache can retain either environment-dependent result.

**Impact:** the strongest positive presentation can be based only on inventory membership or an external provider's unsupported “safe” label. This violates the engine's documented determinism and uncertainty model.

**Required remediation:** separate identity recognition from evidence of risk/status. Use states such as `identified-no-assessment`, `conditions-unknown`, and `externally-identified`; none should become `clean` or improve a score. If vendor output remains, preserve provenance and all verdicts as attributed informational data without changing the local regulatory result.

---

### A-05 — High — The scanner remains armed after acceptance, causing repeat emissions, pending replacement, and stale decoder callbacks

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** code-path confirmed
**Primary evidence:** `src/hooks/use-barcode-scanner.ts:59-113,151-219`; `src/components/dashboard/screens/courses-screen.tsx:171-239,488-510`; `src/components/ui/barcode-scanner-panel.tsx:122-145`

The dedupe stores only the last accepted timestamp. Ignored detections do not extend the quiet period, so a stationary code is accepted again every 700 ms. Camera decoding remains active during lookup, pending price/ingredient entry, and found-result confirmation.

Expected reproductions on a device:

1. Scan A and keep it in frame. After 700 ms it can resolve again and `openPending` resets quantity/price.
2. Confirm A while it remains visible. The next accepted detection finds an existing line and increments quantity immediately.
3. Put A and B in one frame. Native detection loops over every result; both can enter `handleCode` before React has rendered `resolving=true`, creating concurrent lookups and last-completion-wins pending state.
4. Scan B while A is pending. B replaces A without asking about entered price or edited ingredients.

The acquisition token guards only `getUserMedia` startup. An in-flight native `detect()` can resolve after stop/restart and emit into a newer acquisition or start a second RAF loop. ZXing import/`decodeFromStream` has no post-await token check; a stale failure can call `stop()` and tear down a newer stream.

All shared scanner surfaces inherit the acquisition problem. Their consumers vary in how badly they handle it.

**Impact:** silent quantity inflation, lost pending input, wrong product confirmation, misleading beep/flash for a code the consumer ignores, duplicate network work, and camera instability after rapid stop/start.

**Required remediation:** implement a scanner state machine: `idle → acquiring → ready → accepted/paused → explicitly rearmed`. Emit one structured candidate and pause all decoders before feedback. Rearm only after “scan another”, cancellation, or successful line transition, optionally requiring the code to disappear. Add an acquisition generation to every async callback and a synchronous consumer mutex/ref.

---

### A-06 — High — Barcode handling both mutates invalid input and loses valid barcode semantics

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed/reproduced
**Primary evidence:** `src/lib/course-session.ts:36-105`; `tests/course-session.test.ts:87-141`; `src/app/api/barcode/lookup/route.ts:95-102`

Problems reproduced:

- EAN-8 weights are reversed. Standard-valid `96385074` returns `false`; invalid `96385078` returns `true` and is asserted as valid in tests.
- `normalizeBarcode` returns bad-checksum codes as usable. Courses/Knowledge discard the warning; server routes validate length only. Corrupt values reach OFF and Firestore.
- Arbitrary non-digits are removed globally: `LOT-A4006381333931Z` becomes valid GTIN `4006381333931` without warning.
- Decoder format is discarded. Valid UPC-E `04210007` should expand to UPC-A `042000001007`; it is treated as EAN-8 and queried unexpanded.
- GTIN-14/ITF-14 is rejected, making the seed's leading-`1` GTIN-14 alias path unreachable.
- CODE_128 is enabled in both decoders, but its GS1 application identifiers or alphanumeric payload are flattened/rejected downstream.
- The wedge accepts only ASCII digits followed by Enter and lengths 8–13. Manual input strips Arabic-Indic digits in the Arabic interface.
- Expense bypasses normalization completely, so spaces, UPC-A behavior, and invalid formats differ from Courses/Knowledge.

**Impact:** false product identity, duplicate catalog identities, inability to resolve valid North American/logistics codes, and inconsistent behavior by capture method/surface.

**Required remediation:** preserve `{rawValue, format, source}` from the decoder; use one strict canonical GTIN module for client, API, and persistence; implement right-aligned GS1 Mod-10 for GTIN-8/12/13/14; expand UPC-E using its format; accept only explicit separators rather than deleting arbitrary text; normalize localized decimal digits only in manual fields; and block invalid checksums with a clearly labeled manual override that does not masquerade as a verified barcode.

---

### A-07 — High — Lookup consumers have no request identity and the three scan surfaces implement different products

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed by code; stale completion requires timing
**Primary evidence:** `src/components/dashboard/screens/knowledge-screen.tsx:46-68`; `src/components/modals/expense-barcode-scanner.tsx:36-48`; `src/components/modals/ExpenseModal.tsx:428-435`

Knowledge and Expense launch promises without a request ID or abort controller. Scanning A then B can let A's slower completion overwrite B's newer state. Their cameras remain active while loading/found. Courses has a render-state guard, but multiple detections in one callback can pass before the state update renders.

The surfaces are also functionally inconsistent:

- **Knowledge** passes `catalog: []`, ignores the user's saved catalog, fails to pass UI language into resolution, and renders a second manual barcode form beneath the shared panel's manual form.
- **Expense** sends raw codes directly to OFF, skipping canonicalization, catalog, Moroccan seed, prefix-2 logic, and unified domain handling.
- Expense's explicit confirmation discards the barcode, category, image, ranking, quantity, ingredients, and provenance; only `brand – name` fills the expense name.

**Impact:** stale products can be confirmed; offline/saved products work in Courses but not Knowledge/Expense; identical camera UI creates a false expectation of identical semantics.

**Required remediation:** one abortable `resolveScan` orchestrator should own canonicalization, source policy, request identity, domain, and result shape. Each surface should explicitly select what it persists, while preserving the barcode/provenance if it claims product attachment.

---

### A-08 — High — Binary domain routing misclassifies unsupported and unknown products, with no user override

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed/reproduced
**Primary evidence:** `src/lib/food-knowledge/domain.ts:77-106,193-232`; `src/lib/product-lookup.ts:23-30`; `src/components/dashboard/screens/knowledge-screen.tsx:93-111,252-280`

The domain model only returns food or cosmetic and defaults every ambiguity to food. Reproduced `Magix Pâte` / category `Entretien` and generic laundry detergent as food. Conversely, every hit from **Open Products Facts** is tagged `beauty: true`, even though OPF is a generic non-food database that also contains household and pet products.

An unresolved barcode in Knowledge always gets `CoursesFoodPanel`; the always-free no-barcode paste path is also food-only. Therefore an unknown cosmetic—the case most likely to need OCR/manual INCI—cannot reach the cosmetic risk engine. There is no Food/Cosmetic/Household/Unknown selector. French/Arabic names and ambiguous products such as oils worsen the heuristic gap.

**Impact:** users can receive an irrelevant food-allergen/additive panel for cosmetics or cleaners, or an INCI score for generic non-food products. The manual fallback does not actually complete the cosmetic feature end to end.

**Required remediation:** use a domain enum with `food`, `cosmetic`, `household`, `pet`, and `unknown`; treat OFF-family source as provenance, not domain proof; do not mark OPF as beauty; and provide a visible user override before analysis. Unknown manual paste should let the user choose the analyzer.

---

### A-09 — High — Catalog learning is lossy and catalog/seed precedence makes the loss permanent

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed
**Primary evidence:** `src/components/dashboard/screens/courses-screen.tsx:198-231,258-268`; `src/hooks/use-course-session.ts:233-276`; `src/lib/course-session.ts:486-537`

A first remote result reaches pending state with brand, image, pack quantity, source, ranking, ingredients, and beauty hint. `addScannedLine` accepts only a subset; on the first catalog write it loses brand, image, pack quantity, and true source/provenance. It stores source as `session`. Ranking, beauty, category, and ingredient text happen to survive.

Resolution returns catalog hits before every other source and never refreshes them. Seed hits also suppress remote enrichment. Manual fallback records become permanent catalog truth even if OFF gains a record later. A learned prefix-2 label is returned as a normal catalog product on later sessions, so embedded-price extraction no longer runs.

Knowledge's “Save product” write is not consumed by Knowledge (`catalog: []`), omits first-time ranking/quantity, hardcodes `source: off` even for seed/vendor data, and cannot save newly entered ingredients once local `saved` state has disabled the button.

**Impact:** repeated scans become faster but poorer and potentially stale forever; first-scan metadata and later corrections do not reliably survive.

**Required remediation:** persist the complete resolved product plus explicit field-level provenance/retrieved time; use stale-while-revalidate rather than permanent catalog short-circuiting; allow seeds to provide an offline baseline while remote data enriches it; and merge updates transactionally without rewriting source history.

---

### A-10 — High — Shopping persistence is not durable offline and whole-document writes are last-write-wins

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** code-path confirmed
**Primary evidence:** `src/lib/firebase.ts:53-60`; `src/hooks/use-course-session.ts:64-149,160-176`; `src/lib/db.ts:980-1031`

Firebase is initialized with `getFirestore`, which uses the default in-memory cache. When Firebase is configured, the course hook does not use its localStorage fallback. A network-disconnected session is only latency-compensated in current memory; closing/reloading before synchronization can lose the trip.

Every item/quantity/quality change writes the entire session document; Firestore merge does not merge inside the `items` array. There is no revision, transaction, mutation ID, or conflict check for course edits. Two tabs/devices and late async quality writes are last-write-wins. Save errors are logged to the console with no durable outbox or user-visible unsynced state.

**Impact:** the core supermarket use case is vulnerable precisely where connectivity is weak. Concurrent devices can silently overwrite lines or quantities.

**Required remediation:** enable durable multi-tab Firestore persistence where supported and add a tested local outbox/fallback; expose pending/failed sync; use revisioned transactions or per-line documents/operations instead of whole-array snapshots; and bind every write to a stable mutation ID.

---

### A-11 — High — OCR language and lifecycle are tied to UI state, and stale OCR can attach one label to another product

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** code-path confirmed; language behavior confirmed
**Primary evidence:** `src/lib/label-ocr.ts:18-45`; `src/components/dashboard/courses/label-ocr-button.tsx:27-53`; `src/components/dashboard/courses/courses-ingredient-panel.tsx:107-169`

OCR loads languages from the interface locale, not the photographed label. A French/English UI cannot OCR an Arabic label; an Arabic UI loads Arabic + French + English, increasing first-use cost. Language models come from a third-party tessdata CDN on first use, so “offline” OCR is only true after assets are cached.

There is no cancellation or product generation on the OCR promise. `PendingCard` is reused when a new scan replaces the product. If OCR for A completes after pending changes to B, the old closure writes A's overlay but its current callback/state can set the extracted text on B; B can then display and persist A's ingredients.

There is also no crop, orientation/preprocessing, confidence threshold, image-size guard, or confirmation requirement. The photo stays on-device, but extracted text is POSTed to the server, may be forwarded to the optional vendor, and is saved to the account catalog when a course line is confirmed.

**Impact:** cross-product ingredient contamination, common Morocco multilingual failures, long first scan, and inaccurate privacy/offline expectations.

**Required remediation:** give OCR an explicit label-language selector independent of UI locale, a product/acquisition ID, cancellation, bounded preprocessing, confidence and delimiter checks, and mandatory user confirmation. Self-host models or clearly disclose/cache-test the external download.

---

### A-12 — High — Quality persistence, historical display, and backup/restore lose safety-critical context

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed/reproduced
**Primary evidence:** `src/components/dashboard/screens/courses-screen.tsx:241-296`; `src/hooks/use-course-session.ts:225-231`; `src/lib/course-session.ts:247-280`; `src/components/ui/quality-score-chip.tsx:105-126`; `src/lib/finance-backup.ts:689-738`; `src/lib/db.ts:519-533`

Quality analysis starts only after the line is added and targets “the current active session” by barcode. If the user finishes before it resolves, there is no active target and the score is lost. If a different session becomes active, the late callback is no longer bound to the originating session. The write again replaces the full `items` array.

The stored summary keeps only score, band, and three counts. It discards ingredient identities, `worstTier`, unknown count/coverage, form, dataset version/date, vendor provenance, and assessment timestamp. It merges `watch + restricted` into a count displayed as **Watch**, and `caution + prohibited` into a count displayed as **Caution**. A historical prohibited ingredient therefore loses the word “prohibited”, and the user cannot see which ingredient caused Avoid.

The backup reader compounds the loss. Current exports include product `ranking`/`beauty` and session-item `ranking`/`quality`, but allowlists omit them. Reproduced round trip:

- `products[0].ranking` is reported as unrecognized and removed.
- `sessions[0].items[0].ranking` and `.quality` are reported and removed.

Restore uses non-merge batch `set`, so accepting the warning can overwrite richer destination records with the stripped versions. This contradicts the privacy/profile claim of a complete, restorable JSON backup.

**Impact:** quick checkout commonly loses quality; historical “why” is unauditable; restore can delete modern scan/risk metadata.

**Required remediation:** bind analysis to `{sessionId, itemKey, assessmentId}` and update active or completed origin safely; persist either the immutable analysis input + engine version or a full evidence snapshot; preserve exact tiers and uncertainty; add schema migrations for every current field; and add an own-export fixed-point test using production-complete Product/SessionItem fixtures.

---

### A-13 — High — Prefix-2 price and “Made in Morocco” interpretations overstate what a GTIN says

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed; standards comparison confirmed
**Primary evidence:** `src/lib/course-session.ts:57-81,107-109,495-526`; `messages/en.json` (`courses.maBadge`, `courses.priceFromLabel`)

Every uncatalogued valid leading-2 EAN-13 is interpreted with one layout: six item digits + five price digits divided by 100. GS1 reserves 02/20–29 for restricted-circulation identification whose element-string layout is assigned locally/organizationally; it does not define this one Moroccan retailer layout universally. Some labels encode weight, another decimal position, or a different item/price split. The parsed number is displayed in the profile's active currency even though no issuer/currency was identified.

Separately, prefix `611` is rendered as **“Made in Morocco”**. GS1 explicitly states that a GS1 prefix identifies the member organization that allocated the company prefix, not product origin or manufacturing location.

**Impact:** a wrong amount can be prefilled into a bill, and imported products can receive a false origin claim.

**Required remediation:** parse restricted-circulation labels only under a user/store/issuer-specific configuration and show the raw fields for confirmation; never infer currency globally. Rename 611 information to something accurate such as “GTIN allocated through GS1 Morocco”, or remove it unless origin comes from trusted product data.

---

### A-14 — High — User-facing privacy, locality, determinism, and backup claims do not match execution

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed
**Primary evidence:** `messages/en.json` (`ingredientManual.pasteHelp`, `ingredientManual.savedNote`, `legal.privacy`); `docs/COSMETIC_INGREDIENT_SCORING.md`; `src/app/api/inci/analyze/route.ts:112-139`; `src/lib/server/vendor-inci.ts:326-356`

Examples:

- UI copy says manually entered ingredients are “checked locally”; cosmetic analysis is a same-origin server POST and unknown names may be forwarded to `inciapi.com`.
- The methodology opens with “No third-party INCI service is called” and “same INCI → same JSON”, while later code/config calls a vendor whose answer changes the score.
- The panel says “Saved on this device”; in a confirmed course it also enters account-scoped Firestore without an adjacent cloud-sync disclosure.
- The privacy policy names Firebase, hosting, Resend, and Open Food Facts, but not the optional INCI provider, optional food-knowledge provider, or first-use tessdata CDN.
- Documentation says manual cosmetic analysis works offline; unlike food analysis, cosmetic analysis has no local browser fallback.
- The policy calls JSON backup complete/restorable, but A-12 proves current fields are stripped.
- Methodology says snapshot date/legal caveat belongs next to each score; the UI shows only “Informational EU-data index — not medical advice”, without date, legal caveat, form assumption, or vendor source.

**Impact:** users cannot make an informed choice about label-text transmission or cloud persistence, and claims overstate reproducibility/offline capability. This is a product/compliance review issue even if ingredient labels are usually not personal data.

**Required remediation:** align EN/FR/AR copy, privacy policy, docs, and behavior; disclose recipients and transmitted fields conditionally; distinguish on-device OCR from server analysis; state account sync at save time; expose dataset/form/vendor provenance; and stop claiming deterministic/local/offline behavior that configuration can change.

---

### A-15 — Medium — The visible scan frame and zoom do not control decoding; permission/error handling is coarse

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed by code
**Primary evidence:** `src/components/ui/barcode-scanner-panel.tsx:178-245`; `src/hooks/use-barcode-scanner.ts:228-299`

Zoom is only a CSS `transform: scale(...)` on the video preview. Native and ZXing decoders still receive the intrinsic full frame, so zoom neither magnifies decoder pixels nor narrows the search area. The drawn ROI is visual only; codes outside it can be accepted. This worsens multi-code ambiguity while instructing users to align inside the frame.

All `getUserMedia` failures are mapped to `camera-denied`, including no device, device busy, constraints, insecure context, and transient read failures. Expense always says no camera even for denied permission. There is no camera chooser, visibility pause, track-ended handler, permission preflight, or in-progress acquisition cancel state. Courses keeps the camera active through pending editing.

**Remediation:** use hardware track zoom when available or crop decoder input to a real ROI; otherwise remove the misleading controls/frame claim. Classify DOMException names, give actionable recovery, pause on hidden/pending states, and handle ended tracks/camera selection.

---

### A-16 — Medium — Serial lookup budgets can starve cosmetic sources and outlive the client

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed by code/timing bounds
**Primary evidence:** `src/lib/product-lookup.ts:229-269`; `src/app/api/barcode/lookup/route.ts:82-90,231-285`

The client spends up to 4 s on world OFF, then the proxy starts with world OFF again and serially walks six hosts under a 12 s deadline. Beauty and generic-product hosts are after three food hosts. Slow/unreachable food hosts can consume the deadline before the relevant cosmetic source is attempted.

The proxy may then add a 3 s vendor call outside the 12 s walk deadline, while the client gives the proxy 14 s. A near-deadline hit/miss can therefore continue server work after the client aborts. Direct + proxy + outer timeout layers do not share one cancellation/deadline.

**Remediation:** use one end-to-end deadline and cancellation signal; avoid querying world twice; race or bounded-parallelize independent databases; prioritize likely source from format/category/history without treating it as proof; include vendor time inside the deadline; and instrument per-source latency/outcomes.

---

### A-17 — Medium — Raw OFF Nutri-Score points are rendered as a positive `/100`

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed/reproduced with live OFF records
**Primary evidence:** `src/lib/product-lookup.ts:151-166`; `src/components/ui/ranking-chip.tsx:37-42`; `src/lib/store.ts:2556-2574`

`nutriscore_score` is the formula's point total used to map to grade, not a positive quality percentage. Lower is generally better, category thresholds differ, and the value is not bounded to 0–100. The tooltip renders it as `31/100`, implying the opposite direction and scale. Live checks produced water `A / 0`, Coca-Cola `E / 12`, and Nutella `E / ~30–31`.

The letter grade/color is useful; the numeric suffix and type comments are wrong.

**Remediation:** show only the official grade/logo unless the formula points are explicitly labeled as “Nutri-Score calculation points (lower is better)” with version/context. Never append `/100`.

---

### A-18 — Medium — Device INCI overlay removal, precedence, validation, and account boundaries are unreliable

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed by code
**Primary evidence:** `src/lib/ingredient-device-store.ts`; `src/components/dashboard/courses/courses-ingredient-panel.tsx:73-127,172-190`

The overlay is one global localStorage map, not account-namespaced and not cleared on logout. A shared browser can reuse one user's manual formula for another user. It has no source, product-region/version, timestamp, or assessment version.

`initialText` always wins over the overlay, so a corrected device formula can be ignored by a stale remote/catalog formula. “Remove” deletes localStorage and clears local state but does not clear the parent's now-adopted `ingredientsText`; the same-text effect re-adopts it and course confirmation can still save it to Firestore. Parsed localStorage values are cast without validation; a non-string entry can throw on `.trim()` during render.

**Remediation:** use a validated, versioned, user/account-scoped record with source and timestamp; define explicit source precedence and conflict UI; make removal propagate to parent/cloud according to a clear choice; and handle storage events/corruption safely.

---

### A-19 — Medium — Food analysis has the same context/stale-cache pattern and does not receive OFF allergen tags

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed/reproduced
**Primary evidence:** `src/lib/food-analysis-client.ts:18-91`; `src/components/dashboard/courses/courses-food-panel.tsx:97-126`; `src/lib/product-lookup.ts:31-35`

The food cache key contains only raw text/ingredient names and omits label, category, language, and `offAllergenTags`; it is unbounded and has no TTL. A probe with different context made one request and returned the first object. `CoursesFoodPanel.run` has no cancellation/request identity, so old completions can overwrite newer inputs.

Local analysis is computed immediately but withheld while the client waits up to 6 s for the API. Offline results are not cached, so repeated offline checks wait again. The engine supports OFF allergen tags as a cross-check, but product lookup neither requests/maps `allergens_tags` nor passes them into analysis.

**Remediation:** context-complete bounded caches and in-flight identity; render local output immediately and enrich asynchronously; cache deterministic offline output; and plumb trusted OFF allergen tags with source disclosure.

---

### A-20 — Medium — Existing green tests omit lifecycle/concurrency/current-law contracts and encode two defects

**Remediation status (2026-09-09):** Code remediation implemented and regression-covered at `406f003`; see [Section 0](#0-remediation-status-2026-09-09).

**Confidence:** confirmed
**Primary evidence:** `tests/course-session.test.ts:87-141`; `tests/ingredient-safety.test.ts:220-265`; `tests/finance-backup.test.ts:540-590`

Current tests are valuable for reducers and render smoke checks, but:

- The invalid EAN-8 `96385078` is asserted as valid.
- Vendor “safe” recognition increasing coverage/score is asserted as desired behavior.
- Backup fixed-point fixtures omit current `ranking`, `beauty`, and `quality`, so “accepts its own export” does not represent a production export.
- There are no scanner-hook tests for stop/start generations, one-code arming, multiple detections, pending replacement, or wedge variants.
- There are no request-order tests for Knowledge/Expense, cache context, OCR completion after product swap, finish-before-quality, multi-tab session writes, or offline reload.
- There is no current official regulatory conformance matrix or transition-date test.
- Arabic rendering tests exist, but Arabic digit/manual parsing, Arabic INCI, Arabic product-name retrieval, and label-language OCR are not covered.

**Remediation:** add contract tests at each boundary plus browser tests with fake media devices, detector/ZXing fakes, deferred promises, fake IndexedDB/offline transitions, and a legally reviewed dated matrix.

## 5. Regulatory-context findings vs product defects

The following limitations must remain separate from code defects:

1. **EU is not Morocco.** The engine is explicitly EU-data-based, while the likely user market is Morocco. EU Annex status can be useful information but is not a determination of Moroccan legality.
2. **An ingredient list cannot prove compliance.** Most Annex III–VI rules require concentration, product type, body site, age group, professional use, warnings, purity, or combined exposure. Those data are absent from a normal INCI string.
3. **CosIng is informational.** Inventory presence is identity/function information and has no legal value by itself; it cannot support “clean”.
4. **Product safety is formulation-level.** Impurities, traces, packaging, stability, microbiological quality, interactions, exposure, and assessor review are outside this feature.
5. **Ingredient order is only approximate.** Ingredients below applicable thresholds can be listed in flexible order, colorants may be grouped, and order does not reveal concentration. Linear position weighting is a heuristic, not exposure measurement.
6. **Personal sensitivity is not modeled.** Allergy, irritation, pregnancy, age, damaged skin, and medical history cannot be reduced to a universal product score.
7. **Regulations have transitions.** The 2023 fragrance-label expansion and 2024/2025 amendments have placement/making-available dates. A dated engine must represent these explicitly rather than labeling an act simply “current”.

### DINP-specific caution

The application's manual blanket entry “phthalates are banned” includes Diisononyl Phthalate. Review of the current Cosmetics Regulation consolidation and its Annex II phthalate sequence did not support that DINP cosmetics prohibition; ECHA/EFSA materials also distinguish DINP from the classified low-molecular-weight phthalates, while separate REACH restrictions apply to certain toys/childcare articles. The correct remediation is to remove the unsupported cosmetics claim pending a structured current source/legal review—not to replace it with a universal “safe” claim.

## 6. Original recommended remediation sequence (implementation completed)

The sequence below is retained as the original audit plan. Its code work is represented in the Section 0 closure matrix and is complete at `406f003`. The independent legal-review and real-device assurance items remain ongoing release-governance checks rather than claims established by this repository.

### Release block / first 48 hours

1. **Put the cosmetic score behind a safety kill switch.** Keep raw parsed information if useful, but suppress `Clean`, `Excellent`, `Avoid`, stars, `/100`, and universal legal claims until A-01–A-04 have reviewed replacements.
2. **Pause decoding on first accepted candidate.** Add a synchronous scan mutex and explicit rearm; stop pending replacement and stationary-code quantity increments.
3. **Fix canonical barcode validation everywhere.** Correct EAN-8, retain decoder format, enforce checksum consistently, and stop deleting arbitrary characters.
4. **Fix cosmetic cache identity.** Include effective form/context/version and add in-flight deduplication that does not let one caller abort another.
5. **Patch backup schemas before more data is produced.** Preserve product/session ranking, beauty, and quality, with a regression fixture generated from current types.

### Next sprint

6. Replace the legal overlay with a reviewed, dated, condition-aware dataset and conformance tests.
7. Make OCR review mandatory; hard-fail unbalanced structures and support label-language selection.
8. Introduce explicit domain selection and support unknown/household/pet products.
9. Unify Courses/Knowledge/Expense resolution and cancellation.
10. Preserve complete product metadata/provenance and use stale-while-revalidate catalog behavior.
11. Bind quality writes to explicit session/item IDs and retain evidence/version/coverage in history.
12. Enable durable offline writes/outbox and revisioned course mutations.
13. Correct origin and Nutri-Score wording.
14. Align privacy policy, localized copy, and technical docs with actual processors/storage.

### Original validation gates (retained as ongoing assurance)

- Legally reviewed test matrix against the then-current consolidated Regulation 1223/2009 and effective transitions.
- Physical Android Chrome, iOS Safari, and Firefox tests with EAN-8/13, UPC-A/E, GTIN-14, Code 128, multiple codes, torch, camera switch, denied/busy permissions, and backgrounding.
- Slow/offline/reload tests in a real Firebase build.
- Deferred-promise tests for scan A→B, OCR A→B, finish-before-quality, and multi-tab writes.
- EN/FR/AR tests with Arabic-Indic digits, Arabic/French/Latin labels independent of UI locale, RTL overflow, and current privacy copy.
- Backup export → parse → restore → export equality using every current scan/risk field.

## 7. Historical reproduction ledger (`eb588a3`)

These are minimal probes and outputs recorded during the original audit. They are retained as historical evidence and are **not** expected outputs at `406f003`; equivalent corrected boundaries now have committed regression coverage under `tests/`.

```bash
# EAN-8 weighting
npx tsx -e "import {barcodeChecksumValid} from './src/lib/course-session'; console.log(barcodeChecksumValid('96385074'), barcodeChecksumValid('96385078'))"
# observed: false true

# Destructive barcode extraction
npx tsx -e "import {normalizeBarcode} from './src/lib/course-session'; console.log(normalizeBarcode('LOT-A4006381333931Z'))"
# observed: { barcode: '4006381333931', warning: null }

# Parser hides suffix after unmatched parenthesis
npx tsx -e "import {analyzeInciText} from './src/lib/ingredient-safety/analyze'; console.log(analyzeInciText('Aqua, Glycerin (plant derived, Sodium Laureth Sulfate, Parfum',{label:'Face cream'}))"
# observed summary: total 2, recognized 2, score 100, band excellent

# Historical overlay examples at eb588a3
npx tsx -e "import {analyzeInciText} from './src/lib/ingredient-safety/analyze'; for (const x of ['Quaternium-15','4-Methylbenzylidene Camphor','Trimethylbenzoyl Diphenylphosphine Oxide']) { const a=analyzeInciText('Aqua, '+x,{form:'leave-on'}); console.log(x,a.ingredients[1]?.tier,a.score,a.band) }"
# observed: caution 93 excellent; clean 100 excellent; clean 100 excellent
```

A simulated backup round trip at `eb588a3` produced:

```text
product-ranking accepted-but-restored-as ...
  notice: products[0].ranking
  restored product has no ranking

session-ranking-quality accepted-but-restored-as ...
  notices: sessions[0].items[0].ranking, sessions[0].items[0].quality
  restored item has neither field
```

## 8. External references

Authoritative/current references used for the regulatory, nomenclature, and barcode comparisons:

- [Commission Implementing Decision (EU) 2025/1175 — common ingredient-name glossary](https://eur-lex.europa.eu/eli/dec_impl/2025/1175/oj)
- [Regulation (EC) No 1223/2009, consolidation of 18 May 2026](https://eur-lex.europa.eu/eli/reg/2009/1223/2026-05-18/eng)
- [Commission Regulation (EU) 2019/831 — Quaternium-15 and other CMR changes](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32019R0831)
- [Commission Regulation (EU) 2023/1545 — fragrance allergen labeling](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R1545)
- [Commission Regulation (EU) 2024/996 — 4-MBC, vitamin A, arbutins, endocrine-related substances](https://eur-lex.europa.eu/eli/reg/2024/996/oj/eng)
- [Commission Regulation (EU) 2025/877 — TPO/CMR changes](https://eur-lex.europa.eu/eli/reg/2025/877/oj/eng)
- [Commission Regulation (EU) 2026/909](https://eur-lex.europa.eu/eli/reg/2026/909/oj/eng) (mostly future transitions; checked to avoid treating future rules as already effective)
- [GS1 check-digit guidance](https://documents.gs1us.org/adobe/assets/deliver/urn:aaid:aem:77c80eac-d4e2-41b1-a80d-97739060e8f4/How-to-Calculate-a-Check-Digit.pdf)
- [GS1 Company Prefix — prefixes do not identify country of origin](https://www.gs1.org/standards/id-keys/company-prefix)
- [Open Food Facts scanning across food, cosmetics, pet food, and other products](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/)
- [Open Food Facts Nutri-Score formula](https://world.openfoodfacts.org/nutriscore-formula)
- [EFSA 2019 phthalates opinion, including DINP regulatory context](https://efsa.onlinelibrary.wiley.com/doi/full/10.2903/j.efsa.2019.5838)

## 9. Current disposition (updated 2026-09-09)

- **Code remediation:** A-01 through A-20 are implemented at `406f003` and included in PR [#67](https://github.com/mouadlouhichi/flousy-app/pull/67). The branch is clean, and local check/build plus GitHub Actions `check` and browser `e2e` pass.
- **Scan feature:** strict format-aware identity, one-acquisition/one-action handling, generation guards, cancellation, unified resolution, revisioned persistence, and stale-result protection replace the audited unsafe paths.
- **Ingredient feature:** may present source-attributed identity, evidence, and a gated assessment when the parser, review state, product form, applicability, and evidence coverage support it. It must continue to avoid universal “safe”, “clean”, “banned”, medical, or legal-compliance conclusions.
- **Data handling:** OCR review, unknown-name aggregation, provider boundaries, account-scoped overlays, provenance, historical evidence, and backup/restore now use explicit bounded contracts. Consequential label suffixes are rejected whole rather than silently truncated.
- **Nutri-Score and origin:** points are no longer represented as a positive `/100`, and GS1 prefixes are not represented as manufacturing origin. Restricted-circulation price interpretation requires issuer-specific configuration and confirmation.
- **Deployment note:** Vercel checks on the documentation pushes have alternated between a successful preview and the account build-rate-limit status. The latter is an account constraint rather than a source/build failure; the production build passes locally and in GitHub Actions.
- **Ongoing posture:** this remains a label-information and evidence feature, not a substitute for a qualified safety assessor, medical advice, or jurisdiction-specific legal review. Regulatory-data changes require dated review and conformance tests; camera releases require representative real-device checks.
