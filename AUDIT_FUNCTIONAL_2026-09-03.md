# SmartJib (flousy-app) — Deep Functional Audit

> **Scope:** product/functional review of the 2026-09-03 tree
> (`main` @ `31dcf72`), read against the history in
> [`AUDIT_2026-08-31.md`](AUDIT_2026-08-31.md), [`MVP_TODO.md`](MVP_TODO.md),
> [`PERFORMANCE_REPORT.md`](PERFORMANCE_REPORT.md) and
> [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md).
> The earlier security/SEO hardening passes are not re-litigated here; this
> audit looks at **what the product does for a user, where it still falls
> short, and what to build next**.

**Date:** 2026-09-03 · **Branch:** `arena/01a06539-flousy-app`

---

## 1. Gates re-verified on this tree (not assumed)

| Gate | Result |
| --- | --- |
| `npm ci` | clean install, 596 packages |
| `npm run lint` (ESLint + Rules ANTLR parse, `--max-warnings 0`) | **clean** |
| `npm run typecheck` / `typecheck:strict` | **both clean** |
| `npm test` | **343 tests / 76 suites, 0 fail** |
| `npm run build` | **passes, 40 routes** (public + dashboard + APIs) |
| `npm run test:rules` | not runnable here (needs Java 21) — remains a CI/release gate |
| `npm run test:e2e` | Playwright specs exist (`landing`, `i18n` incl. FR + RTL, `contact`, `demo-journey`); browser-dependent, runs in CI |

The 2026-09-02 reconciliation claims hold on today's tree. Everything below was
verified by reading the money engine (`src/lib/store.ts`), the sync layer
(`finance-sync.ts`, `db.ts`, `dashboard-provider.tsx`), `firestore.rules`, the
household RBAC model, the course-session design and the screen components.

---

## 2. Overall verdict

This is an **unusually rigorous codebase for an indie product** — better
engineered than most funded fintech MVPs. The three things that stand out:

1. **The money model is trustworthy.** Every mutation is a conservation
   operation (refund-then-charge on edits, idempotent duplicate guards for
   outbox replays, cent-precise rounding with the savings envelope absorbing
   the remainder, `MoneyInvariantError` before cash can appear or vanish).
   Writes carry monotonic revisions, stable mutation IDs, an immutable ledger
   per change, Firestore transactions and an IndexedDB outbox with explicit
   conflict/retry/discard states. This is the hardest part of a budgeting app
   and it is genuinely done.

2. **Authorization is server-side and granular.** Rules enforce ownership,
   the exact 90-day launch-trial window (immutable, non-repeatable claim),
   month close/reopen semantics, and — rare even in professional apps —
   **per-field area checks on the shared household month document** via
   `diff().affectedKeys()` against the member's RBAC matrix. The browser UI is
   defense-in-depth, not the boundary.

3. **The product is honest.** No fake features, no card capture, no bank-sync
   pretence, consent-gated allowlisted analytics, truthful deletion reporting,
   CSV/JSON portability outside the paywall. The historical audits forced this
   honesty and it stuck.

The remaining risk is **no longer code quality**. It is (a) the external launch
gates already tracked in `PRODUCTION_CHECKLIST.md` (CI activation, rules
emulator runs, DNS/email, monitoring), and (b) a small set of **functional
gaps that hurt daily usefulness** — led by debt lifecycle across months
(§4.1) — plus depth in analytics and reminders. Those are the highest-leverage
next features (§5).

---

## 3. Functional strengths confirmed in code

| Area | Evidence |
| --- | --- |
| Envelope math with no rounding leak | `calculateEnvelopeAmounts` floors needs/wants, savings absorbs remainder; strategies ratio-sum-validated |
| Expense lifecycle | add/edit/delete refund the old place before charging the new one; `availableForCharge` explains same-place edits |
| Fixed-charge lifecycle | `planned → partial → paid → skipped`, `paidAmount` tracked separately from `amount`; recurring templates materialize once per period with deterministic IDs (no duplicate retries) |
| Transfers & adjustments | `moveMoney` conserves total; `updateMoneyPlaces` writes immutable `BalanceAdjustment` audit rows (capped 500) |
| Savings | goals are global (survive rollover) with real-deposit vs bookkeeping distinction (`deposited`); monthly flow computed from the month's own activity log, not lifetime counters — the double-count trap is explicitly handled |
| Money places | built-in bank/home/wallet + unlimited user-defined places with rename/reassign/retire flows; balances clamped ≥ 0 |
| Period model | configurable start day, period-bound expense dates (`assertExpenseDateInPeriod`), close/reopen with Rules-enforced read-only state, currency snapshot per period |
| Household | 11 RBAC areas, owner/editor/viewer/contributor + custom matrix, invite-mediated join (verified email + expiring code), contributor invoice → transactional owner approval that posts into the month |
| Course capture | barcode normalization/checksums, per-user self-learning catalog, OFF fallback, **Morocco-specific variable-measure barcodes** (prefix-2 EAN-13 with embedded price), deterministic bill render, idempotent posting |
| Data ownership | CSV export (formula-injection neutralised), localized CSV import (quote-aware, duplicate fingerprints, caps), versioned JSON backup + confirmation-gated restore, deletion with per-collection partial-failure report |
| i18n | EN/FR/AR catalogs with parity tests, RTL, locale-aware amount parsing (French commas, Arabic-Indic digits), localized category/bill/strategy labels |
| Sync/offline | local month cache + durable outbox; demo mode is explicit and banner-marked |

---

## 4. Fresh functional findings (not in prior audits)

### F-1. 🟥 Debts do not survive the month rollover — and cannot be repaid cross-period

The most significant functional defect found in this pass.

- Debts live inside the month document (`month.debts`) and **are not carried
  forward**: `buildRolloverSeed` carries income sources, categories and (with
  Pro) the bank remainder; `carryOverFixedExpenses` carries bills. There is no
  `carryOverDebts`, and `createNewMonth` starts with none.
- `DebtsTab` renders only the **currently viewed month's** debts. An open
  August loan silently vanishes from the September Debts screen (the data is
  still in the August document, but the user's mental model is “my debts
  list”).
- Worse: `recordDebtPayment` enforces `assertExpenseDateInPeriod`. A payment
  dated in September **cannot** be recorded against a debt stored in August —
  it throws `outside-period`. Multi-month repayment (the normal case for a
  loan or a salary advance) forces users to duplicate the debt each month and
  manually track the remaining balance.

This contradicts the app's own architecture: savings goals were made global
(`users/{uid}/data/savings`) precisely because obligations outlive periods.
Debts and credits deserve the same treatment.

**Fix options** (ordered):
1. Move open debts to a global `users/{uid}/data/debts` collection (mirroring
   savings goals, with household equivalents), each payment posting a cash
   movement into the month where the payment date falls. Cleanest, but a
   migration + rules change → needs the Java rules suite in the loop.
2. Cheaper bridge: at rollover, carry open debts forward into the new month
   (with deterministic IDs for idempotency, like fixed-charge templates) and
   keep the payment-in-period rule. The August copy stays immutable history;
   September holds the live obligation.

### F-2. 🟧 The “80/20 Rule” strategy is numerically identical to 50/30/20

`STRATEGIES['80-20']` stores `needsRatio: 0.50, wantsRatio: 0.30,
savingsRatio: 0.20` — exactly the 50/30/20 row. The name and description
(“Spend 80% on Needs & Wants, save 20%”) promise a pooled-spending model, but
the envelope engine only knows three buckets, so the choice silently produces
the same numbers as the first strategy. Two UI options with identical outcomes
undermine trust the first time a user notices.

**Fix:** either (a) remove `80-20` (migrate existing months to `50-30-20`),
(b) implement a real pooled variant (needs+wants as one 80% allocation with a
sub-split the user sets), or (c) relabel it honestly (e.g. “50/30/20 (savings-
focused copy)”). Also: the README still says “Four strategies” — there are
seven including `70-20-10` and `custom`; minor doc drift.

### F-3. 🟧 Analytics are bounded to 6 months and static

`fetchMonthsForTrends(count = 6)` and the Trends tab render month-over-month
bars, category/person/income breakdowns and a health score — good, but:
- no 12-month or year-over-year view (trivial: the `count` param already
  exists, batched via `Promise.all`);
- no net-savings-rate trend over time (the data to compute it is already
  fetched);
- no year-end export (the CSV export is per-month).

### F-4. 🟨 No cross-month transaction search

`VariableTab` search is per-month only. “How much did I spend on the dentist
this year?” requires clicking through months. The trends fetch already
normalises 6 months client-side; a “search history” screen over the last 12–24
months is a small step from what exists.

### F-5. 🟨 Household members don't share a product catalog

Products are per-user (`users/{uid}/products/{barcode}`). Two members of the
same household both scanning the same groceries build separate catalogs —
double the OFF lookups and no shared “last price” memory. The course session
itself is also personal-only (C19 acknowledges the shared-session gap). Given
that Household is a Pro pillar, a household-level catalog (read: members,
write: owner/editor) is a natural entitlement-aware feature.

### F-6. 🟨 No reminders of any kind (not even in-app)

Push is deliberately post-launch (fair — iOS PWA constraints are real), but
there is no in-app notification centre either: no “rent due in 3 days”, no
“goal 80% funded”, no “trial ends in 7 days” (the trial banner exists on the
Pro panel only). All the data for these triggers already exists (due days,
`status: 'planned'`, `deposited/target`, `entitlementEndsAtMs`).

### F-7. 🟦 Smaller observations

- **Receipts stay inline** (bounded 100 KB each) — fine at launch, but a month
  with many receipts trends toward the 1 MiB document ceiling; the Storage
  migration remains the right eventual home.
- **`assertExpenseDateInPeriod` blocks all forward planning** beyond the
  current period end — reasonable for cash accounting, but a “planned next
  month” queue would soften onboarding for bill-heavy users. (Fixed charges
  already model this via `planned` status, so the gap is mainly perception.)
- **Course → budget posts one expense, one category** (C19): a 40-line
  grocery trip lands as a single “Groceries” total. Acceptable for launch,
  but per-line splitting is the single biggest courses improvement.
- **Envelope assignment is still keyword-derived** (`bucketOf` with FR/AR
  keyword lists). The audit history's suggested explicit per-category
  envelope override remains the better model — the keyword matcher should
  only seed a default. (`F-16` was closed via localization; the structural
  fix is still open.)
- **2,000 variable-expense cap per month**: a heavy course logger with CSV
  imports could approach it; the subcollection migration stays on the debt
  list at scale (K1, known).

### F-8. Needs/Wants classification is keyword guessing — measured ~60% wrong on realistic custom categories

`bucketOf()` (store.ts:606) classifies every expense by **substring-matching
the category name** against two hard-coded keyword lists (~30 wants-words for
fixed bills, ~40 needs-words for variable, EN+FR+AR). The bucket is never
persisted and never user-controllable. Executed against 20 realistic category
names (`npx tsx`, 2026-09-03): **12 classified wrong**, including:

| User's category | Kind | Classified | Should be |
| --- | --- | --- | --- |
| Medicine / Médicaments | variable | **wants** | needs |
| Doctor / Dentist | variable | **wants** | needs |
| School fees / Crèche / حضانة (daycare) | variable | **wants** | needs |
| Electricity (custom, not "Utilities") | variable | **wants** | needs |
| Baby diapers | variable | **wants** | needs |
| Disney+ / Shahid VIP / Canal+ | fixed | **needs** | wants |

Also: fixed bills default to *needs* and variable to *wants* when nothing
matches; renaming a category instantly re-buckets **all historical months**
(the bucket is re-derived from the name at render time). This directly skews
the 50/30/20 progress bars on the core Overview screen.
Fix: persist an explicit `envelope` per category (user chooses in
ManageCategoriesModal; keywords only seed the default for new/imported
categories).

### F-9. Plan-gating gaps found while tracing the entitlement system

- **`incomeSources` is advertised as Pro but gated nowhere.** README and
  `PRO_FEATURES` list "multiple income-source management"; the
  IncomeSourcesModal has no Pro check and `PRO_FEATURES` is used only for
  display (pro-panel / ProUpgradeModal).
- **"Budget rollover" ships as two different mechanisms with two different
  gates, one with no on-switch.** (a) Bank-remainder carry at period creation
  (`dashboard-provider.tsx:581`) keys on `workspace === 'household' || isPro`
  — it ignores the household entitlement expiry, so an expired household
  keeps rolling over, contradicting the "falls back to free tier" contract in
  `household.ts`. (b) Category-budget rollover (`normalizeMonth` via
  `userProfile.enableRollover`) is dead config: **no UI ever sets it** — only
  backup restore writes the flag.
- **Soft (UI-only) gates by design:** trends, category caps, barcode scan
  data (products/sessions are owner-writable in Rules regardless of plan).
  Acceptable while billing is free-trial-only, but they must move to a server
  boundary before real money is charged.

The entitlement *spine* itself (one exact 90-day claim, ±5 min server-time
window, immutable afterwards, household projection, expiry-aware resolution)
is correctly applied in Rules and code.

---

## 5. Feature recommendations

Ordered by value-to-effort, grouped into what I would ship next.

### Tier 1 — fix what the model already promises (days, not weeks)

1. **Global debt ledger** (F-1 fix). Open debts survive rollover; payments
   post into the period where they happen. Add a “remaining balance” roll-
   forward so a September payment against an August loan is one tap.
2. **Honest strategy list** (F-2 fix) + a live envelope preview in the
   strategy selector (the math exists; it is a UI affordance).
3. **12-month trends toggle + savings-rate line** (F-3): parameterise `count`,
   add a derived net-savings-rate series, add “this year vs last year” on the
   year view. No schema change.
4. **Upcoming bills card on Overview**: fixed expenses with a due day and
   `planned/partial` status, filtered to the next 7 days of the open period.
   Pure derivation from existing data.
5. **In-app notification centre** (F-6): due bills, category cap warnings
   (BudgetAlerts already computes them), goal milestones, trial countdown.
   Local-only, no provider, no consent question.

### Tier 2 — deepen the core loop (1–2 months)

6. **Explicit per-category envelope override** — kill keyword bucketing as the
   source of truth (`categoryEnvelopes` on the category, keyword match only
   seeds new categories). This is the last structural i18n risk in the money
   model.
7. **Course per-line category split at posting** (C19): map catalog
   categories → budget categories with a remembered mapping; post N expenses
   atomically in one mutation (the transactional commit already supports
   multi-doc writes).
8. **Household product catalog + shared course sessions**: members of an
   entitled household share the barcode catalog and can join a trip; the bill
   posts once. Doubles the value of both Pro pillars at once.
9. **Recurring variable expenses**: weekly market/fuel as templates that
   materialise occurrences like fixed charges do (deterministic IDs, no cash
   movement until confirmed).
10. **Spending pace + goal forecasting**: “at this rate Groceries exceeds its
    cap on the 24th”; goal completion date from the average of the last N
    months' `savingsActivity`. Both are pure client-side derivations.
11. **History search** (F-4): 12–24-month transaction search with category/
    place/person filters; export the result set.

### Tier 3 — differentiation bets (quarter-scale)

12. **Household settlement (“who owes whom”)**: members pay shared bills
    unevenly; the app computes balances and suggests a settling transfer. The
    invoice workflow and per-member attribution already exist — this is the
    feature that makes Household irreplaceable for couples.
13. **Morocco-first imports**: a paste-in parser for common Moroccan bank
    SMS/duplicate-alert formats (no Plaid/compliance needed) feeding the
    existing CSV-import pipeline with remembered per-bank mappings. Nothing
    else on the market does this; it converts the “no bank sync” limitation
    into a local moat.
14. **Price history & inflation insights** (C18): the catalog already stores
    `lastPrice`; keep a small per-barcode price log and surface “your usual
    basket is +6% vs last quarter”.
15. **Zakat & Hijri calendar option**: zakat calculation (2.5% of eligible
    holdings) as a special savings goal type; Hijri month labels alongside
    Gregorian. Deeply on-brand for the primary market and almost no platform
    risk.
16. **Multi-currency money places**: a place denominated in EUR alongside MAD
    with a user-entered rate — the “where it is held” axis is the natural home
    for this, and it serves the diaspora explicitly listed in the 12
    supported currencies.
17. **Quick-capture surfaces**: PWA share-target (“share a receipt/amount into
    SmartJib”), home-screen quick-add shortcut, and eventually on-device
    receipt OCR (P8) once the capture funnel proves out.
18. **Budget templates / copy-last-month** at period creation, and a
    year-in-review exportable summary (PDF/CSV) — retention moments.

### Positioning notes

- The **“what it's for vs where it's held” separation** is the product's
  distinctive idea; almost nothing in the market models places. Lean into it:
  per-place envelopes view, per-place trend history. It is currently
  under-exploited as a differentiator.
- **Brand reconciliation** (SmartJib vs Flousy, repo vs domain) is still the
  open SEO-8 item — decide before marketing spend.
- The **90-day no-card trial** is a good launch posture, but the moment real
  billing lands, the CMI/Stripe seam must ship — the entitlement projection
  (source/status/start/end) is already webhook-shaped, so this is provider
  work, not redesign.

---

## 6. Suggested order of work

1. **Debt ledger fix** (F-1) — it is the only finding that makes the product
   *wrong* about money today; pair it with the rules-emulator run it requires.
2. **Strategy honesty + 12-month trends + upcoming-bills card + notification
   centre** — one “usefulness” PR, no schema changes.
3. **Category envelope override** (structural i18n close-out).
4. **Course per-line split + household catalog** (makes both Pro pillars
   worth paying for eventually).
5. Then the Tier 3 differentiation bets, ordered by appetite — with the
   Moroccan bank-SMS parser (13) and household settlement (12) as the two
   highest-leverage options.

*Every claim above was verified against the working tree on 2026-09-03; the
gates in §1 were executed, not assumed.*

---

## 7. Remediation log — 2026-09-03 (same day, branch `arena/01a06539-flousy-app`)

All findings from §4–§5 Tier 1 were implemented and re-verified:

| Finding | Status | Implementation |
| --- | --- | --- |
| **F-1 debts lost at rollover** | ✅ Fixed | `carryOverDebts()` in `store.ts`: open debts ride the period rollover (creation paths + the same ensure-effect as recurring bills) with full payment history and deterministic `debt-carry-{base}-{period}` ids; settled debts stay behind as history; a carried debt is payable inside the new period (tests cover idempotency, settlement, cross-period payment) |
| **F-2 duplicate 80/20 strategy** | ✅ Fixed | `'80-20'` removed from `STRATEGIES` (kept in the union for legacy reads); `normalizeMonth` migrates legacy months to `50-30-20` — label-only change, numbers identical; selector/onboarding lists updated; migration test added |
| **F-3 bounded/static trends** | ✅ Fixed | 6/12-month range toggle on the month-over-month card (`trendsMonthCount` provider state drives the batched fetch) + a "Net saved" column (received income − needs/wants spend, with rate) |
| **F-6 no reminders** | ✅ Fixed | The header bell is now a notification centre: budget health + household invites (existing) **plus** bills due within 7 days, savings goals ≥80% funded, and a Pro-trial countdown (≤14 days); unread state persisted per reminder set |
| **Tier-1 #4 upcoming bills** | ✅ Added | Overview card listing planned/partial fixed charges due in the next 7 days, resolved against the period window (handles custom month-start days crossing calendar months); `fixedBills` RBAC-gated |
| **F-8 keyword-only needs/wants** | ✅ Fixed | `categoryEnvelopes` persisted per month + `defaultCategoryEnvelopes` on the profile; `envelopeFor()` is the single classification entry (explicit override → keyword seed); UI: Needs/Wants segmented control per category (Variable budgets panel) and in the add-category form; defaults seeded to match historical classification so existing budgets don't shift; Firestore Rules whitelist extended for custom members |
| **F-9a ungated income sources** | ✅ Fixed | First source free; additional sources require an active entitlement (household inheritance honoured), enforced at modal render with an honest Pro card instead of the add form |
| **F-9b broken rollover gating** | ✅ Fixed | Bank-remainder carry now uses `isProFeatureUnlocked` (expired household entitlements fall back to free-tier); category-budget rollover has a real on-switch: a Pro-gated preferences toggle for personal workspaces and the same toggle for household owners (`updateConfiguration` path), persisted via the existing config plumbing |
| README/docs drift | ✅ Fixed | Strategy count and Pro feature list corrected; this log records the rest |

Gates after remediation: `npm run lint` (incl. Rules ANTLR parse) clean ·
`tsc` normal **and** strict clean · **358 tests / 80 suites pass** (15 new
tests: envelope overrides, debt carry-over, upcoming bills incl. shifted
periods, net savings rate, 80/20 migration) · production build passes ·
`firebase-blueprint.json` regenerated via `scripts/update-blueprint-model.mjs`.

Notes for the release gate:

- `firestore.rules` changed (one whitelist key) — the Java 21 emulator suite
  must run before deployment, as already required by the production checklist.
- The month document gained one optional map (`categoryEnvelopes`); legacy
  documents normalize on read, no migration needed.
- Tier 2/3 features from §5 (course per-line split, household product catalog,
- explicit envelope *history* re-classification, Moroccan bank-SMS import,
  settlement, price history, zakat, multi-currency places, history search)
  remain open and are not claimed anywhere in the product.

## 8. What deliberately did NOT change

- SEO/FAQ copy still says "4 budgeting strategies" listing the four
  headline presets — technically true (70/20/10 and custom also exist); a full
  copy refresh across EN/FR/AR + `llms.txt` + parity tests is cosmetic work
  better batched with the next landing-page pass.
- Cross-month transaction search (F-4) and the shared household product
  catalog (F-5) need product decisions on navigation and sharing semantics;
  they stay open rather than half-shipped.
- `assertExpenseDateInPeriod` still rejects forward-dated entries outside the
  open period by design (cash accounting); the debt carry-forward removes the
  only case where that rule blocked a legitimate money movement.
