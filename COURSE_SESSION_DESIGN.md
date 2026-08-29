# Course Session — Solution Design

> Status: **Design only — no implementation yet**
> Scope: a "course" (shopping trip) capture flow — start a session, scan
> product barcodes, let the product auto-resolve, add prices with minimal
> friction, and finish with a bill-format total.
>
> Companion docs: `README.md` (data model & invariants), `DESIGN.md`
> (visual language), `firestore.rules` (security baseline).

---

## 1. What the feature is

A lightweight, POS-like flow for capturing a grocery run:

1. **Start a course** — one tap.
2. **Scan each product's barcode** — the product (name, brand, optional
   image, category) **auto-resolves**; the user only enters the price.
3. **Finish** — the app produces a **bill** (receipt-style itemization with
   a grand total) that can be shared, exported, and optionally **logged into
   the budget** as a variable expense (money leaves the chosen place).

Non-goals (v1): no stock/inventory, no price prediction, no multi-store
comparison, no receipt-photo OCR. Household sharing is a later phase.

---

## 2. User flow

```
Dashboard ── "Courses" (quick action + nav) ──▶ Session screen
                                                    │
        ┌───────────────────────────────────────────┤
        ▼                                           ▼
  No active session:                     Active session:
  empty state + big "Start course"       Scan view (default tab)
  button.                                · camera scanner (auto)
                                         · manual code field (always)
  Start course → creates                 Each resolved product → line item
  an `active` session (currency,        (name, qty, unit price, line total)
  date, place = last used / bank).      · re-scanning the same code = qty + 1
                                         · running total pinned at bottom
                                                    │
                                                    ▼ "Finish"
                                               Bill view (receipt)
                                               · items, line totals, TOTAL
                                               · place, date, item count
                                               Actions:
                                               · Save (active → completed)
                                               · Log to budget (optional toggle)
                                               · Share / Copy / Download (txt, csv)
                                               · Discard (only while empty or via confirm)
```

Rules that keep the UX "easy":

- **Single active session per user.** Opening Courses with a live session
  resumes it (never silently lost). Starting a new one while one is active
  requires Finish or Discard first.
- **Re-scan = add one.** Scanning a code already on the bill increments its
  quantity instead of prompting. New scans open a one-field price step.
- **Price step is one field.** Unit price input (decimal keyboard) with:
  - prefill from the product's **last recorded price** (catalog),
  - big centered input, auto-focus, Enter/✓ confirms,
  - quantity stepper (1, 2, 3…) beside it; line total and grand total
    update live.
- **Everything is editable after the fact** — tap any line to change qty,
  price, or name; swipe/× removes it.
- **Currency** comes from the profile; no conversion, ever.

---

## 3. Barcode → product resolution (the core)

### 3.1 Inputs and normalization

Scanners (camera or hardware) emit digits, but codes arrive in several
flavors. All inputs pass through **one** normalizer before any lookup:

```
raw code
  → trim, strip spaces/hyphens, keep digits only
  → length 12 (UPC-A)  → prefix "0"        (→ EAN-13)
  → length 8  (EAN-8)  → keep as-is
  → length 13 (EAN-13) → keep as-is
  → other length       → NOT_A_BARCODE (manual path, code kept as-is if ≤13)
  → verify checksum (mod-10, alternating 1/3 weights)
       valid   → normalized barcode (id: "8" | "13" digits)
       invalid → WARN (show a "code looks wrong" hint) but still try catalog
                 and allow manual entry — never block the user.
```

Why checksum: it catches camera mis-reads (8 vs 0, 3 vs 8) before we
"remember" a bad product in the catalog.

### 3.2 Resolution pipeline (Morocco-aware)

One cascade, tried in order; first hit wins. Moroccan barcodes (prefix
`611` — see §3.5) are tagged and take the MA-tuned path; everything else
is identical.

```
normalized barcode
   │
   ├─ 1. LOCAL CATALOG (user's `users/{uid}/products/{barcode}`)
   │      hit → product card: name, brand, category, LAST PRICE prefill
   │      source: "catalog" — zero latency, works offline.
   │
   ├─ 2. REMOTE INDEX (first-time products only)
   │      2a. (P2) STATIC MA SEED — cached shard of the Morocco-filtered OFF
   │          snapshot (§3.5.4). 0 ms, works offline.
   │      2b. OPEN FOOD FACTS live lookup:
   │          GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
   │              ?fields=code,product_name,brands,image_front_url,categories,quantity
   │          status == 1 → product card: name, brand, image, category guess
   │                        (no price — price is always user-entered)
   │      auto-save into the local catalog (source: "seed" | "off") so the
   │      next scan of the same code is instant.
   │
   └─ 3. MANUAL (always available, even fully offline)
          product card with the barcode attached, empty name (required)
          + optional brand/category + "remember this barcode" (on by default)
          + (P2) opt-in "share with Open Food Facts" community contribution.
```

**Decision table**

| Catalog | Seed (P2) | OFF live result | Outcome |
|---|---|---|---|
| hit | — | — | instant card, last price prefilled |
| miss | hit | — | instant card, no price, cached in catalog |
| miss | miss | `status 1` | remote card, no price, **cached in catalog** |
| miss | miss | `status 0` / 404 / error / timeout (4 s) | manual card, code attached |
| miss | (offline) | skipped | manual card |

Notes on **Open Food Facts** (the only external dependency):

- Free, open dataset, **no API key**. Verified live: **22,820 products
  tagged Morocco** (`countries_tags=en:morocco`), including local brands
  (e.g. `6111246721261` — *Milky Food Professional* fromage blanc), and
  store tags for MA chains (Carrefour 402, Marjane 168, Bim 27, Acima 15,
  Aswak Assalam 8). MA data grows continuously — the Yuka app is a major
  contributing source (visible in `data_sources_tags`).
- Sends **only the barcode digits** — no user data leaves the device;
  consistent with the app's privacy stance ("never connects to your bank").
- National-brand coverage is good; private-label / hyper-local items are
  the gap → covered by the self-learning catalog + manual entry (§3.5).
- The catalog makes the app self-improving: a product costs a remote call
  **once per user**, forever local after. Grocery baskets are highly
  repetitive (≈ 2/3 of items are repeats), so a user's catalog converges
  within a handful of sessions.
- **CORS**: OFF's API is browser-friendly, but this must be verified at
  implementation time. Fallback if the browser is blocked: a thin Next.js
  route `POST /api/barcode/lookup` that forwards the code to OFF and returns
  the mapped fields (in-memory LRU, 5 min TTL, 100 entries — pure hygiene,
  no user data). The client interface is identical either way, so the
  pipeline does not change.
- Respect rate limits: only one lookup per unique code per session; 429
  falls through to manual and is retried next session at most.

### 3.3 Where scanning happens (input sources)

This is a PWA, so "scanning" means four mechanisms, auto-detected at runtime
behind one `useBarcodeScanner()` hook:

| # | Source | How | Coverage |
|---|---|---|---|
| 1 | **Camera — native** | `getUserMedia` + `BarcodeDetector` (formats: `ean_13`, `ean_8`, `upc_a`) | Chrome/Android, Samsung Internet. Fastest, no extra code. |
| 2 | **Camera — JS fallback** | `getUserMedia` + `@zxing/browser` `BrowserMultiFormatReader` (lazy `import()` only when source 1 is absent) | Any browser with camera, incl. **iOS Safari** (no `BarcodeDetector`). |
| 3 | **Hardware scanner (keyboard wedge)** | Global keydown listener while session active: digit bursts (≤ 60 ms between keys, 8–13 digits, terminated by Enter) are treated as scans | USB/Bluetooth laser scanners on desktop — the most reliable source when present. |
| 4 | **Manual entry** | Always-visible numeric field on the scan view; explicit "Add" | Every device, always. Also the only path for non-barcode items (produce, etc. — user just types a name, no code). |

Detection order at session start:

```
if ('BarcodeDetector' in window)        → source 1
else if getUserMedia supported          → source 2
always                                   → sources 3 + 4 attached
Camera denied / no camera → sources 3 + 4 only, with a hint.
```

Requirements: secure context (HTTPS — the PWA already is), camera
permission requested on first scan (not at app start).

### 3.4 Scan-event handling (state machine per scan)

```
onCode(code)
  → debounce: same normalized code seen < 1500 ms ago  → drop (camera re-detect)
  → normalize + checksum (§3.1)
  → resolve (§3.2) → ProductCard {name, brand?, category?, imageUrl?, lastPrice?}
  → if code already a line item            → qty += 1, confirm with toast
  → else                                   → open price step (auto-focused)
  → on confirm:
        append line {barcode, name snapshot, qty, unitPrice, lineTotal, category?}
        update catalog.lastPrice (if source != manual-without-code)
        update grand total
```

Line items store **snapshots** (name, category) — the bill must render
identically years later even if the catalog entry changes or is deleted.

---

### 3.5 Moroccan product coverage — researched options

**Bottom line first:** there is *no* public Moroccan barcode database — no
data.gov.ma product dataset, no GS1 Maroc product registry, no local
equivalent of France's open GMS barcode file. So the solution is a
**Morocco-first layered pipeline**, not a single Moroccan source.

| # | Source | What it actually is (verified) | Verdict |
|---|---|---|---|
| 1 | **Open Food Facts** — world API v2 + MA instance `ma-fr.openfoodfacts.org` | 22,820 MA-tagged products, **barcode-keyed**, free, no API key; includes local MA brands; MA data grows via Yuka (major MA contributor) | ✅ **primary remote index** (P1) |
| 2 | **Static MA seed** (self-built from OFF) | CI job paginates the OFF search API (`countries_tags=en:morocco`, ~230 requests at size=100 — no multi-GB dump), emits a small versioned JSON shard served by a Next route, cached in IndexedDB | ✅ **P2** — 0 ms + offline resolution of every OFF-known MA product |
| 3 | **GS1 Maroc** (gs1ma.org) | Member org that *issues* GTINs (prefix **`611`** — confirmed by GS1 country-code lists and real MA barcodes); GEPIR / "Verified by GS1" is a web form only (30 free searches), company-level info, **no API**; GS1 US Data Hub is paid | ⚠️ prefix detection only |
| 4 | **Generic aggregators** (upcdatabase.org, barcode.monster, brocade.io, barcodelookup.com) | 5M–700k global items; paid keys / redistribution ToS; **verified empty** for a real MA EAN (6111246721261 on upcdatabase.org → no record) | ❌ rejected |
| 5 | **Retailer/e-com sites** (marjanemall.ma, acimanet.com, jumia.ma…) | marjanemall is a **3rd-party marketplace**, not Marjane's store catalog (and has consumer complaints); Acima blocks bots; Jumia has no official API (third-party Apify scrapers are deprecated); retailer pages expose name+price but rarely the EAN — they can't answer a *barcode* query directly anyway | ❌ rejected (ToS risk + no EANs); revisit only via partnership |
| 6 | **Open Prices** (OFF price DB, public REST API) | 304k+ price points but **currently France-centric**; MA volume unverified (country filter to check at implementation) | ⏳ **P3** — MAD price *suggestions* only if MA data justifies |
| 7 | **data.gov.ma / HCP** | Price-*index* statistics, no product/EAN-level dataset | ❌ none |

**Recommended MA-first stack:**

1. **Local catalog** (always first) — the real coverage engine.
2. **Static MA seed** (P2) — every OFF-known Moroccan product resolvable in
   0 ms, even offline, from the user's very first scan.
3. **OFF live lookup** (P1) — catches products added to OFF after the last
   seed build (the seed is a snapshot; OFF keeps growing between builds).
4. **Manual + remember** (P1) — the long tail; converges fast thanks to
   basket repetition (≈ 2/3 of a basket is repeats).
5. **Community contribution** (P2, opt-in) — when the user enters a brand-
   new product, one tap "share with Open Food Facts" (requires the user's
   own OFF account, explicit consent, shown only once per product). Grows
   the 22.8k for *every* user and makes the app give back to the open
   ecosystem it relies on.

**MA-specific pipeline touches:**

- Prefix `611` → tag product `origin: 'MA'` (badge in product card,
  "Fabriqué au Maroc") and use it to pick the seed shard.
- Seed shard shape: `GET /api/catalog/shard/611.json` ≈ a few MB (22.8k ×
  `{code, product_name, brands, categories, image_front_url}`); built
  monthly in CI, versioned (`?v=2026-09`); client keeps the last 2 shards
  in IndexedDB so the PWA stays useful offline.
- Freshness: if a seed hit is older than ~90 days and OFF live returns
  data, prefer OFF and note the refresh (seed stays as offline fallback).

**Honest expectation:** OFF covers national brands and a large share of the
shelves, but private-label / hyper-local items will still hit manual entry
the first time. That is acceptable by design: the cost is one name + one
price, and the product is then instant for that user (and for the community
if shared).

---

## 4. Data model

### 4.1 TypeScript (in `src/lib/store.ts`, following existing patterns)

```ts
export interface Product {
  barcode: string;        // doc id: 8 or 13 digits, checksum-verified
  name: string;           // required (manual path enforces)
  brand?: string;
  category?: string;      // best-effort; maps to a budget category when logged
  imageUrl?: string;
  lastPrice?: number;
  priceUpdatedAt?: string;
  source: 'manual' | 'off' | 'session';
  createdAt: string;
  updatedAt: string;
}

export interface SessionItem {
  barcode?: string;       // undefined for name-only (no-code) lines
  name: string;           // snapshot
  category?: string;      // snapshot
  qty: number;            // ≥ 1
  unitPrice: number;      // ≥ 0
  lineTotal: number;      // round2(unitPrice * qty) — stored, never re-derived
}

export interface CourseSession {
  id: string;
  status: 'active' | 'completed';
  startedAt: string;      // ISO
  endedAt?: string;       // ISO
  date: string;           // YYYY-MM-DD (the trip)
  currency: string;       // profile currency snapshot
  place: MoneyPlace;      // where it was paid from (default: last used / bank)
  items: SessionItem[];   // capped at 500
  total: number;          // denormalized sum of lineTotals
  loggedToBudget?: boolean;
  loggedExpenseId?: string; // id of the created VariableExpense (idempotency)
}
```

### 4.2 Firestore layout

Mirrors the existing `users/{uid}` tree (subcollection per entity,
document-id-as-key so a resolution is a single index-free `getDoc`):

```
users/{uid}
  products/{barcode}   → Product            (catalog; id = normalized barcode)
  sessions/{sessionId} → CourseSession
```

- Catalog read on session start: `getDocs(query(collection(products), limit(2000)))`
  (a user realistically never exceeds this; the 1 MB doc limit is a
  non-issue because each product is its own small document).
- Sync follows the current app pattern: `subscribeProducts(uid, cb)`
  (`onSnapshot`), `subscribeActiveSession(uid, cb)`
  (`where('status','==','active')`), `saveSession(uid, session)`
  (`setDoc(merge)`), all in `src/lib/db.ts` with the existing
  `handleFirestoreError` wrapper.
- **Demo mode** (Firebase unconfigured): catalog + session persist to
  `localStorage` exactly like the rest of the demo store, so the flow is
  fully testable without a backend.
- Household scope (Pro, phase 3): `households/{hid}/sessions/...` with the
  existing `householdEditor` rules; the personal design is unchanged.

### 4.3 `firestore.rules` additions (sketch)

```
match /products/{barcode} {
  allow get, list: if owner(uid);
  allow create: if owner(uid)
    && (barcode matches '^[0-9]{8}$' || barcode matches '^[0-9]{13}$')
    && incoming().name is string && incoming().name.size() > 0 && incoming().name.size() <= 100
    && (!('lastPrice' in incoming()) || isMoney(incoming().lastPrice));
  allow update: if owner(uid)
    && (!('lastPrice' in incoming()) || isMoney(incoming().lastPrice))
    && (!('name' in incoming()) || (incoming().name is string && incoming().name.size() <= 100));
  allow delete: if owner(uid);
}

match /sessions/{sessionId} {
  allow get, list: if owner(uid);
  allow create: if owner(uid)
    && incoming().status == 'active'
    && isMoney(incoming().total)
    && incoming().items.size() <= 500
    && incoming().place in ['bank','home','wallet'];
  allow update: if owner(uid)
    && isMoney(incoming().total)
    && incoming().items.size() <= 500
    && (!('status' in incoming()) || incoming().status in ['active','completed']);
  allow delete: if owner(uid);
}
```

(The default catch-all `allow ... if false` stays last, as today.)

---

## 5. The bill (total in bill format)

The **completed session document is the bill** — no separate collection;
the bill is a deterministic render of it.

### 5.1 Format (text rendering, used by share/copy/download; the UI renders
the same data in the design system — receipt-style card, monospace numbers)

```
        SMARTJIB — COURSE
   2026-08-29 · 12 items · MAD
--------------------------------
  Lait 1L            2 × 17.00   34.00
  Pain               1 ×  8.00    8.00
  Œufs x6            1 × 15.50   15.50
  ...
--------------------------------
  TOTAL (12 items)              214.50
  Paid from: Bank
```

### 5.2 Totals rules (deterministic, unit-tested)

- `lineTotal = round2(unitPrice × qty)` — stored on the line.
- `total = round2(Σ lineTotal)` — stored on the session, updated on every
  mutation (add, qty change, edit, delete). The UI grand total and the
  bill always read the stored value — no float drift, no re-computation.
- `qty` is an integer ≥ 1; `unitPrice ≥ 0`; zero-price lines allowed
  (gifts/free samples) and shown as `0.00`.

### 5.3 Bill actions

| Action | Mechanism |
|---|---|
| **Share** | Web Share API (text) → falls back to copy-to-clipboard toast |
| **Copy** | Clipboard, same text |
| **Download** | `.txt` (bill) and `.csv` (`name,qty,unit_price,line_total`) via Blob — reuses the existing CSV export utilities in `src/lib/export.ts` |
| **Print** | print stylesheet on the bill view (optional, cheap) |
| **Log to budget** | see §6 |

---

## 6. Logging the bill into the budget

On **Finish**, an optional toggle (default: on) — "Log to budget":

- Creates **one** `VariableExpense` on the current month via the existing
  `addVariableExpense(month, expense)` (money conservation invariant
  stays intact — the total debits `session.place`):
  - `name`: "Courses (12 items)" (localized),
  - `amount`: `session.total`,
  - `type`: the category chosen by the user on the Finish step,
    defaulting to the **dominant item category** or "Groceries" if absent
    from `activeCategories` (falls back to "Other"),
  - `place`: `session.place`, `date`: `session.date`,
  - `note`: `Course session {id}` (traceability; the expense row links
    back to the bill in the session list).
- **Idempotency**: `session.loggedToBudget = true` + `loggedExpenseId`
  are written in the same save; the "Log to budget" button is disabled
  afterwards (re-logging is not offered in v1).
- Session history screen: list of completed sessions (date, total, place,
  logged?) → open any bill again.

v2 (Pro, later): split the bill into **per-category** expenses instead of
one aggregate.

---

## 7. UI placement & i18n

- **Entry points**: "Courses" tile in `quick-actions.tsx` + a nav item in
  `nav-items.ts` (screen `courses`), icon: shopping-cart/scan.
- **Screen**: `src/app/dashboard/courses/page.tsx` +
  `src/components/dashboard/screens/courses-screen.tsx` (mobile-first
  full-bleed; desktop: centered card).
- **New components** (design system compliant — cards 24px radius, teal
  primary, pill chips, ghost inputs):
  - `ScannerView` (camera canvas / status),
  - `ManualCodeField` (also catches keyboard-wedge input),
  - `ProductPriceSheet` (bottom sheet: product card + qty stepper + price),
  - `SessionItemList` (lines, qty steppers, line totals, remove),
  - `BillView` (receipt + action row).
- **i18n** — new keys in `messages/en.json`, `fr.json`, `ar.json` (3
  languages, RTL-checked): `courses.title` ("Courses" / "Courses" /
  "المشتريات"), `courses.start`, `courses.scanHint`, `courses.price`,
  `courses.finish`, `courses.bill.total`, `courses.bill.share`,
  `courses.bill.logToBudget`, unknown-code warning, etc.

---

## 8. Testing plan (pure functions first, in `tests/`)

1. `normalizeBarcode` — padding (12→13), whitespace, invalid lengths,
   checksum pass/fail (known-good + one-digit-corrupted fixtures).
2. `resolveProduct` cascade — catalog hit; OFF hit (mocked) incl. cache
   write; OFF miss/offline/timeout → manual; checksum-invalid handling.
3. Scan reducer — debounce window, re-scan = qty+1, edit doesn't clobber
   existing price, totals after every mutation.
4. `computeLineTotal` / `computeSessionTotal` — rounding (0.005 cases),
   zero-price lines, 500-item cap.
5. `renderBillText` — deterministic golden output (incl. Arabic/RTL names,
   long names, empty bill).
6. Integration — logging a session via `addVariableExpense` preserves the
   money-invariant the rest of the suite guards (bank/home/wallet sums).

No new test infra: `tsx --test tests/*.test.ts` already runs pure-logic
tests; the scanner hook itself is exercised manually per the detection
matrix in §3.3.

---

## 9. Edge cases & failure modes

| Case | Behavior |
|---|---|
| Camera permission denied / no camera | Sources 3–4 remain; hint shown once |
| iOS Safari (no BarcodeDetector) | zxing-js lazy-loaded automatically |
| Bad OCR / checksum fail | Warning hint; catalog + manual still offered (never block) |
| OFF down / slow / 429 | 4 s timeout → manual path; next session retries once |
| Non-barcode item (produce) | Name-only line, no code — bill still works |
| App closed mid-session | `active` session persisted; resumed next open (single active) |
| Price entered as total vs unit | Unit price only (v1); qty × unit shown to disambiguate |
| 1 MB / size limits | Per-product docs (tiny); 500-item session cap enforced in rules |
| Currency change mid-feature | Session snapshots the currency at start |
| Offline (demo or PWA offline) | Catalog + manual fully functional; OFF path skipped |

---

## 10. Phasing

| Phase | Scope |
|---|---|
| **P1 (MVP)** | Catalog + manual entry + camera scan (native + zxing fallback) + OFF live lookup & cache (MA prefix tagging) + session list + bill view (share/copy/download txt/csv) + rules + i18n + tests |
| **P2** | Log to budget (single aggregate expense), session history, CSV import/export of catalog, `receiptUrl`-style link from the expense to its bill, **static MA seed** (CI build + Next route + IndexedDB), **opt-in OFF community contribution** |
| **P3** | Last-price suggestions (+ Open Prices MA if its MA data volume justifies), price history per product, per-category bill splitting, household sessions (Pro), hardware-scanner auto-detect polish, print CSS |

## 11. New dependencies (proposed)

- `@zxing/browser` (camera JS fallback; lazy-loaded) — **only** new runtime
  dep. `BarcodeDetector` needs none; the manual path needs none.
- No backend changes for P1 except the optional `/api/barcode/lookup`
  proxy (only if browser CORS to OFF fails verification).

---

## 12. Open questions (need your call before P1)

1. **Catalog ownership** — personal only (as designed) or household-shared
   from day one? (Design is personal-only; sharing is a P3 add.)
2. **Default "Log to budget"** — default **on** (bill auto-becomes an
   expense) vs default **off** (bill is just a record)? I recommended on
   with a visible toggle at Finish.
3. **Aggregate vs per-category expense** when logging (design: aggregate
   in P2; per-category is P3 Pro).
4. **Bill currency label** — profile currency symbol only, or always
   "CODE" (e.g. "MAD") in the text export? (Design: CODE in exports,
   symbol in UI.)
5. Should the OFF lookup be **on by default** (opt-out in Settings) — the
   only place a barcode digit string leaves the device?
6. **Static MA seed** — approve the P2 CI job + `/api/catalog/shard/611.json`
   route (the only new server-side element of the feature)?
7. **Community contribution** — keep the opt-in "share with OFF" in P2, or
   keep the app strictly read-only against OFF (catalog stays private only)?
