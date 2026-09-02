# MVP Todo & Implementation Audit

> Last updated: 2026-09-02
>
> Legend: ✅ Done · ⏭️ Deliberately deferred · 🔧 Partial / needs polish

---

## 💰 Core Budgeting

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Four budgeting strategies (50/30/20, Zero-Based, Envelope, Pay-Yourself-First) | ✅ | Fully implemented in `store.ts` |
| 2 | Strategy ratios sum to exactly 100% | ✅ | Enforced in `calculateEnvelopeAmounts()` |
| 3 | Auto-scaled category budgets fill envelope to the last unit | ✅ | `calculateCategoryBudgets()` with remainder distribution |
| 4 | Category bucket resolution per kind (variable vs fixed) | ✅ | `bucketOf()` in `store.ts` |
| 5 | Editable per-category caps | ✅ | Via `ManageCategoriesModal` |
| 6 | Live Budget Plan card (Overview tab) | ✅ | Shows needs/wants/savings progress bars |
| 7 | Envelope amounts always sum to income (no rounding leak) | ✅ | Savings envelope absorbs remainder |

## 💵 Money Places & Expenses

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 8 | Three money places: Bank, Home, Wallet | ✅ | `MoneyPlace` type |
| 9 | All income starts in bank | ✅ | `createNewMonth()` defaults to bank |
| 10 | Move Money between places | ✅ | `MoveMoneyModal` + `moveMoney()`, conserves total cash |
| 11 | Add variable expense (debits money place) | ✅ | `addVariableExpense()` |
| 12 | Edit variable expense (adjusts places correctly) | ✅ | `editVariableExpense()` — refunds old, debits new |
| 13 | Delete variable expense (refunds place) | ✅ | `deleteVariableExpense()` |
| 14 | Add fixed monthly charge | ✅ | `addFixedExpense()` |
| 15 | Edit fixed charge | ✅ | `editFixedExpense()` |
| 16 | Delete fixed charge | ✅ | `deleteFixedExpense()` |
| 17 | Search & category filtering for variable expenses | ✅ | In `VariableTab` |
| 18 | Month-to-month navigation | ✅ | Previous/next month buttons in header |
| 19 | Month rollover — new month inherits plan with clean slate | ✅ | `normalizeMonth()` + `createNewMonth()` |
| 20 | Places clamp at zero (never negative) | ✅ | `Math.max(0, ...)` in all operations |

## 🎯 Savings Goals

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 21 | Savings goals are global (survive month rollover) | ✅ | Stored at `users/{uid}/data/savings` |
| 22 | Create savings goal | ✅ | `SavingsModal` in 'create' mode |
| 23 | Edit savings goal | ✅ | `SavingsModal` in 'edit' mode |
| 24 | Fund goal (debits place → increases goal) | ✅ | `fundGoal()` |
| 25 | Withdraw from goal (decreases goal → credits place) | ✅ | `withdrawGoal()` |
| 26 | Delete funded goal returns balance to its place | ✅ | `deleteFundedGoal()` |

## 🧾 Debts & Credits

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 27 | Add debt/credit entry | ✅ | `DebtModal` + `DebtsTab` |
| 28 | Edit debt/credit | ✅ | `editDebt()` |
| 29 | Delete debt/credit | ✅ | `deleteDebt()` |
| 30 | Toggle debt status (open/settled) | ✅ | `toggleDebtStatus()` |
| 31 | Debts tab with I Owe / Owed to Me toggle | ✅ | `DebtsTab` component |

## 👤 Onboarding & Authentication

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 32 | 5-step guided onboarding (income → categories → bills → strategy → review) | ✅ | `/onboarding` page |
| 33 | Email/password sign-in | ✅ | `signInEmail()` / `signUpEmail()` |
| 34 | Google sign-in (popup + redirect fallback) | ✅ | `signInGoogle()` with in-app browser detection |
| 35 | Password reset | ✅ | `sendResetEmail()` |
| 36 | Email verification | ✅ | `sendVerificationEmail()` + banner |
| 37 | Demo mode without Firebase | ✅ | localStorage fallback, triggered on `/login` |
| 38 | User profile (plan, currency, onboardingComplete, theme, language) | ✅ | `UserProfile` in Firestore |

## 🔧 Settings & Data Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 39 | Currency selection (12 currencies) | ✅ | `SUPPORTED_CURRENCIES` in `currency.ts` |
| 40 | Locale-aware formatting | ✅ | `Intl.NumberFormat` per currency locale |
| 41 | Dark mode / light mode / system | ✅ | Theme control under Profile → Preferences |
| 42 | CSV export | ✅ | Free data-portability action in Profile → Data; `export.ts` neutralizes formula injection |
| 43 | CSV import | ✅ | Pro bulk importer with localized header mapping, duplicate detection, caps, and exact-expiry/RBAC re-checks at modal-open and mutation time |
| 44 | Truthful in-app account deletion | ✅ | `deleteAccount()` + `deleteUserAccountData()` with recent-login and partial-failure recovery |
| 45 | Sign out | ✅ | Clears localStorage + sessionStorage |
| 46 | Pro launch entitlement | ✅ | One no-card, exact 90-day launch trial; provider-neutral CMI/Stripe boundary is disabled until live billing is approved |

## 🏗 Categories

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 47 | Default categories with colors and icons | ✅ | 9 defaults in `normalizeMonth()` |
| 48 | Custom categories with color + icon picker | ✅ | `ManageCategoriesModal` |
| 49 | Category chips/indicators in UI | ✅ | Color dots, icon badges throughout |
| 50 | Category icons from Material Symbols | ✅ | Preset icon grid |
| 51 | Remove categories (minimum 1 enforced) | ✅ | Min 2 categories in UI, min 1 in data |

## 👪 Household / Person Tracking

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 52 | Assign expenses to household member | ✅ | Person field in Expense/Fixed/Debt modals |
| 53 | Household spending breakdown | ✅ | `TrendsTab` shows per-person spending |
| 54 | Filter variable expenses by person | ✅ | Person filter in `VariableTab` |

## 📱 PWA & Installability

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 55 | Web App Manifest | ✅ | `public/manifest.json` |
| 56 | Maskable icons (separate from "any") | ✅ | Verified by PWA tests |
| 57 | Service worker with fetch handler | ✅ | `public/sw.js` |
| 58 | Service worker precaches only existing files | ✅ | Tested |
| 59 | Service worker never caches Auth/Firestore traffic | ✅ | Bypasses `firestore.googleapis.com` and `identitytoolkit.googleapis.com` |
| 60 | `beforeinstallprompt` capture pre-hydration | ✅ | `InstallPromptCapture` inline script |
| 61 | Install button + iOS install sheet | ✅ | `InstallButton` + `IosInstallSheet` |
| 62 | Install banner | ✅ | `InstallBanner` |
| 63 | Offline app shell | ✅ | SW serves offline page |
| 64 | Apple meta tags for standalone PWA | ✅ | `apple-mobile-web-app-capable` |

## 🔐 Security & Infrastructure

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 65 | Firestore security rules | ✅ | Ownership/RBAC, entitlement expiry, immutable trial claims, revision+ledger coupling, month locks, money bounds and bounded collections |
| 66 | Content Security Policy (CSP) proxy | ✅ | `src/proxy.ts` applies origin-based CSP and cache policy to pages and APIs without forcing dynamic rendering |
| 67 | Zod validation on all forms | ✅ | `validation.ts` — expense, fixed bill, move money, goal, auth, category schemas |
| 68 | CSV injection neutralisation | ✅ | `escapeCsvCell()` prepends `'` to formula triggers |
| 69 | Demo mode fallback when Firebase unconfigured | ✅ | Graceful degradation throughout |
| 70 | Route error boundary | ✅ | `src/app/error.tsx` |
| 71 | 404 page | ✅ | `not-found.tsx` |
| 72 | Loading states / skeletons | ✅ | `loading.tsx` + skeleton loaders in dashboard |

## 🌐 i18n & Internationalisation

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 73 | i18n framework (en, fr, ar) | ✅ | `translations.ts`, `i18n.ts`, `i18n-light.tsx`, `i18n-context.tsx` |
| 74 | Message files for all 3 locales | ✅ | `messages/en.json`, `messages/fr.json`, `messages/ar.json` |
| 75 | RTL support (Arabic) | ✅ | `dir` attribute, RTL locale detection |
| 76 | ICU plural resolution | ✅ | `resolvePlural()` in `i18n-core.ts` |
| 77 | Locale-aware number formatting | ✅ | `getIntlLocale()` maps language to Intl locale |
| 78 | Language cookie + localStorage persistence | ✅ | `setLanguageCookie()` + `LANG_STORAGE_KEY` |
| **79** | **UI strings actually translated to FR/AR** | ✅ | All three locale files fully populated with localized translations. New keys added for trends, alerts, recurring bills, income source analytics, and debts/credits. |

## 🚀 Landing Page & SEO

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 80 | Landing page with multiple sections | ✅ | Hero, Features, How It Works, Pricing, FAQ, etc. |
| 81 | JSON-LD structured data (SoftwareApplication, Organization, WebSite, FAQ) | ✅ | Factual Free/90-day-trial offers rendered through `json-ld.tsx` |
| 82 | Sitemap | ✅ | `sitemap.ts` excludes private routes |
| 83 | Robots.txt | ✅ | `robots.ts` |
| 84 | Open Graph / Twitter card metadata | ✅ | Per-page metadata |
| 85 | `llms.txt` for AI crawlers | ✅ | `public/llms.txt` |
| 86 | Blog posts | ✅ | 3 posts in `blog.ts` |
| 87 | Legal pages (privacy, terms) | ✅ | `/privacy`, `/terms` |
| 88 | Additional static pages (about, contact, careers, help, cookies) | ✅ | All present |

## 🔄 Firestore & Persistence

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 89 | Live Firestore subscription for month budget | ✅ | `subscribeMonthBudget()` with `onSnapshot` |
| 90 | Live Firestore subscription for savings goals | ✅ | `subscribeSavingsGoals()` |
| 91 | Durable optimistic writes and conflict handling | ✅ | IndexedDB outbox, transactional three-way merge, revisions, immutable ledger and truthful retry/discard UI |
| 92 | localStorage fallback for offline/demo | ✅ | `flousy_month_${monthKey}` local caching |
| 93 | Normalize legacy documents on read | ✅ | `normalizeMonth()` backfills missing fields |
| 94 | `cleanUndefined()` utility for Firestore | ✅ | Prevents `undefined` field errors |
| 95 | Detailed Firestore error handling | ✅ | `FirestoreErrorInfo` interface + console logging |

## 🧪 Testing

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 96 | Store money-math invariants (strategy ratios, envelope sums, category budgets) | ✅ | `store.test.ts` — 4 strategies × 5 incomes |
| 97 | End-to-end user journeys (add → edit → delete expense conserves cash) | ✅ | `flows.test.ts` |
| 98 | Validation (NaN, Infinity, negative, absurd input) | ✅ | `validation.test.ts` |
| 99 | CSV export (injection safety, ordering, empty accounts) | ✅ | `export.test.ts` |
| 100 | PWA manifest, icons, SW, install prompt capture | ✅ | `pwa.test.ts` — 10+ tests |
| 101 | SEO (sitemap, robots, llms.txt, currency/strategy alignment) | ✅ | `seo.test.ts` |

## 📋 Remaining / Post-MVP Items

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P1 | **Launch Pro access / future billing seam** | ✅ | No card collection or simulation. One exact 90-day trial is Rules-enforced; later CMI/Stripe uses provider-hosted checkout, verified webhooks and Admin SDK entitlement projection |
| P2 | **Recurring income and fixed charges** | ✅ | Deterministic planned occurrences carry into fresh personal and household periods without debiting cash or duplicating concurrent retries |
| P3 | **Multi-month trends / analytics view** | ✅ | `TrendsTab` fully rewritten with month-over-month bar chart, trend summary table, income source breakdown, category breakdown, household spending, and budget health — all driven by `fetchMonthsForTrends()` from `db.ts` |
| P4 | **Budget alerts ("80% of groceries used")** | ✅ | Category-level alerts added to `BudgetAlerts`: flags any category representing >60% of variable spending (warning at 60%, error at 80%). Envelope-level 80%/100% thresholds unchanged. |
| P5 | **Full i18n UI translation (FR, AR)** | ✅ | Added all missing keys for trends, alerts, recurring bills, income source analytics, and debts/credits. All three locale files (en, fr, ar) fully populated with localized translations. |
| P6 | **Shared / household budgets** | ✅ | Rules-enforceable owner/editor/viewer/contributor access **plus a custom role with a per-area permission matrix enforced in `firestore.rules` via `diff().affectedKeys()`**, entitlement-gated writes, contributor invoice workflow, Resend invitations, exports and workspace switching |
| P7 | **Bank sync (Plaid / Tink)** | ⏭️ | Deliberately post-launch: requires provider/compliance selection and is not needed for safe manual budgeting |
| P8 | **Receipt OCR / smart scanning** | ⏭️ | Deliberately post-launch; compressed/bounded receipt attachment works without claiming OCR |
| P9 | **Income sources — analytics per source** | ✅ | Per-source income breakdown with percentage bars, total combined income display, and source-level contribution percentages in `TrendsTab` |
| P10 | **Push notifications** | ⏭️ | Deliberately post-launch; requires a separate consent and delivery design |
| P11 | **Data export — JSON backup** | ✅ | Full-workspace JSON export plus schema-validated, confirmation-gated restore with partial-failure reporting |
| P12 | **Month locking / archiving** | ✅ | Owner close/reopen, read-only UI, offline conflict protection, ledger audit, and Rules enforcement across edits, invoices and course posting |

## 🐞 Known Issues / Tech Debt

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| K1 | Whole-document monthly aggregate | Medium | Bounded to 2,000 variable expenses; revisioned transactions prevent lost updates, but a future subcollection migration will be needed at larger scale |
| K2 | Firestore write-frequency abuse controls | Low | Rules enforce authorization/shape but cannot rate-limit; enable Firebase App Check and budget alerts in production |
| K3 | Styling mixes Tailwind utilities with inline styles and CSS variables | Low | Cosmetic tech debt |
| K4 | Lint command wiring | Resolved | `npm run lint` runs ESLint with zero warnings and the authoritative Firebase Rules syntax parser; normal/strict TypeScript and emulator behavior remain separate gates |
| K5 | Receipts stored inline rather than Firebase Storage | Low | Images are resized/compressed and capped at 100k characters; Storage remains a scale optimization |
| K6 | Randomness fallbacks | Low | Persisted modern-browser IDs use `crypto.randomUUID()`; `Math.random()` remains only for cosmetic choices, deterministic test hooks, or obsolete-runtime fallback |
| K7 | No rate limiting on Firestore writes | Low | Could hit Firestore write limits under heavy usage |
| K8 | No email rate limiting for auth flows | Low | Password reset / verification emails could be spammed |

---

## 🛒 Course Session (shopping-trip capture)

> Design: [`COURSE_SESSION_DESIGN.md`](COURSE_SESSION_DESIGN.md) — barcode
> product resolution (catalog → Open Food Facts → manual) with Morocco-first
> coverage.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| C1 | Barcode normalization (EAN-8/13, UPC-A→13, checksum) | ✅ | `normalizeBarcode()` + `barcodeChecksumValid()` in `course-session.ts` |
| C2 | Self-learning product catalog (per user) | ✅ | `users/{uid}/products/{barcode}`; demo mode uses `localStorage` |
| C3 | Product resolution cascade (catalog → OFF → manual) | ✅ | `resolveProduct()`; 4 s timeout degrades to manual entry |
| C4 | Open Food Facts lookup (direct + server proxy fallback) | ✅ | `product-lookup.ts` + bounded `/api/barcode/lookup` cache; failures degrade to manual entry |
| C5 | Moroccan detection (GS1 prefix 611) + "Made in Morocco" badge | ✅ | `isMoroccanBarcode()` |
| C6 | Camera scanning (BarcodeDetector → zxing fallback) | ✅ | `use-barcode-scanner.ts`; 1.5 s re-detect debounce |
| C7 | Hardware scanner (keyboard wedge) + manual code field | ✅ | Digit-burst + Enter; manual field always available |
| C8 | Active session: re-scan = qty +1 and user-confirmed price step | ✅ | Prices are not guessed from stale catalog data; valid variable-measure EAN-13 embedded prices may be prefilled for confirmation |
| C9 | Bill on finish (receipt text, share/copy/.txt/.csv) | ✅ | `renderBillText()`/`renderBillCsv()` — deterministic 46-col layout |
| C10 | Session history (completed courses → reopen bill) | ✅ | `users/{uid}/sessions`, 100 latest |
| C11 | Firestore rules (barcode id pattern, money bounds, 500-line cap) | ✅ | `firestore.rules`; blueprint kept in sync |
| C12 | i18n (EN/FR/AR incl. RTL bill rendering) | ✅ | `messages/*.json` → `courses` section |
| C13 | Entry point (quick action "Start Course") + screen routing | ✅ | `/dashboard/courses`, hidden from the 5-destination nav |
| C14 | Unit tests (normalize/reducer/totals/bill/resolve) | ✅ | `tests/course-session.test.ts` |
| C15 | Log bill to budget (variable expense) | ✅ | `courses-budget-logger.tsx` — one variable expense for the trip total; grocery-like category by default, first active category as fallback (`resolveCourseCategory`); idempotent via `loggedExpenseId` |
| C16 | Static MA seed shard (CI-built OFF snapshot, offline 0 ms) | ⏭️ | Post-launch optimization; live lookup and manual fallback are complete |
| C17 | Opt-in "share product with Open Food Facts" | ⏭️ | Post-launch contribution feature requiring separate consent |
| C18 | Last-price suggestions / price history | ⏭️ | Post-launch; deliberately avoids presenting stale market prices at launch |
| C19 | Per-category bill splitting, household sessions (Pro) | ⏭️ | Post-launch enhancement; atomic whole-session posting is complete |
| C20 | Barcode scan gated to the Pro plan | ✅ | `courses-scan-upsell.tsx` replaces the scanner panel on free plans; unlocked via `isProFeatureUnlocked` (household members included), name + price entry stays free |

---

## Summary

Repository implementation is complete for the intended launch scope: manual budgeting, savings, debt, recurring lifecycle, durable synchronization, Household collaboration, course capture, localization, backup/restore, month locking, and the no-card 90-day Pro trial. This statement does not replace clean release-gate evidence. Bank aggregation, OCR, push delivery, catalog seed sharing, and advanced course analytics are explicitly post-launch integrations—not hidden launch blockers.

Production operations and final validation are owned by [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md): Rules-emulator/build evidence, verified domains/senders, secrets, App Check/monitoring, DNS email authentication, workflow permissions, legal approval, backup/rollback, and deployment smoke tests.
