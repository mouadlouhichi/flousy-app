# Flousy — MVP Readiness Analysis & Todo List

> Analysis date: 2026-07-26 · Branch: `arena/019f9fe2-mybudget-app` · Base commit: `b192c63`

---

## 1. What the project is today

**Stack:** Next.js 14.2.35 (App Router, all client components) · React 18 · TypeScript (strict) · Tailwind 3 (used only for layout utilities; visual styling is inline `style={{}}` + CSS variables in `globals.css`) · Firebase 12 (Auth + Firestore) · Recharts · Phosphor + Lucide icons.

**Size:** 2,582 lines of source across 11 files. `src/app/dashboard/page.tsx` alone is **1,281 lines (~50% of the codebase)** and contains 8 modal components, 4 tab views, and the root dashboard container.

**Build health:** ✅ `tsc --noEmit` passes clean. ✅ `next build` succeeds (5 static routes). No lint config, no tests, no CI.

### Data model
```
users/{uid}                     → UserProfile { plan, currency, onboardingComplete, … }
users/{uid}/months/{YYYY-MM}    → MonthBudget { totalBudget, bank/home/walletPart,
                                    variableExpenses[], fixedExpenses[],
                                    variable/fixedCategoryBases, activeCategories,
                                    categoryColors, categoryIcons }
users/{uid}/data/savings        → SavingsData { goals[] }   ← global, not per-month
```

### What already works end-to-end
| Area | Status |
|---|---|
| Email/password + Google sign-in, password reset | ✅ Working |
| 5-step onboarding (income → categories → bills → strategy → review) | ✅ Working |
| Month rollover (carries budget plan, resets transactions) | ✅ Working |
| Variable expenses by category, grouped + recent list | ✅ Working |
| Fixed charges with actual-vs-budget tracking | ✅ Working |
| Saving goals (global, active/pending, fund from bank/home/wallet) | ✅ Working |
| Bank / Home / Wallet money-place split | ✅ Working |
| Custom categories with color + icon picker | ✅ Working |
| Live Firestore sync with error banners | ✅ Working |
| Month-to-month navigation | ✅ Working |
| Firestore security rules (per-user isolation) | ✅ Written, needs deploy |
| Responsive: mobile bottom nav + desktop sidebar | ✅ Working |
| PWA manifest + icons | ⚠️ Partial (no service worker → not installable-offline) |
| Graceful "Firebase not configured" screen | ✅ Working |

---

## 2. Critical blockers — must fix before MVP launch

These are correctness/data-integrity bugs and legal requirements. Nothing ships without these.

- [ ] **B1 · No edit for any record.** Expenses, fixed charges, and saving goals can only be *created* and *deleted*. A typo'd amount forces delete-and-retype, and deleting a funded goal silently destroys the money that left the wallet. Add edit modals for `VariableExpense`, `FixedExpense`, and `SavingGoal`.
- [ ] **B2 · Deleting a saving goal leaks money.** `delSaving` (dashboard/page.tsx:1136) removes the goal but never returns `goal.current` to its money place. Money vanishes from the app's accounting. Either return funds on delete or require an explicit "withdraw first" step.
- [ ] **B3 · No withdraw-from-goal flow.** `AddFundsModal` moves money *in* only. There is no way to take money back out of a goal — a core saving-tracker operation.
- [ ] **B4 · Money places don't decrement on spend.** Adding an expense updates `variableExpenses` but never reduces `bankPart`/`homePart`/`walletPart`. The three money-place tiles on the hero card drift out of sync with reality the moment you log spending. Either (a) attach a money place to each expense and decrement it, or (b) relabel the tiles as "allocation" not "balance". **This is the single biggest conceptual gap** — the app claims "every dirham lives in one of three places" but only savings honour it.
- [ ] **B5 · "Spend Trajectory" chart is fake.** `sparkData` (page.tsx:546) hardcodes W1=18%, W2=35%, W3=56%, W4=82% of the current total. It's a fabricated curve, not real data. Compute real weekly buckets from `expense.date` or remove the chart.
- [ ] **B6 · No Privacy Policy / Terms pages.** Required by Google Sign-In OAuth consent, the App/Play stores, and GDPR for any public launch. Add `/privacy` and `/terms` routes and link them from `/login`.
- [ ] **B7 · Firestore rules have no validation.** Rules check ownership only. A malicious client can write a 10 MB month document or arbitrary fields, and there is no write rate-limiting. Add `request.resource.data` size/shape validation.
- [ ] **B8 · `.next/` was not gitignored.** Build output was untracked-but-visible in `git status`. *(Fixed in this pass — added `.next/` and `*.tsbuildinfo` to `.gitignore`.)*
- [ ] **B9 · Six stale `.diff` files committed at repo root** (`feat.diff`, `flousy_fix3.diff`, `flousy_fix4.diff`, `flousy_fixes2.diff`, `flousy_onboarding.diff`, `mybudget_fix5.diff` — 3,136 lines total). Dead patch artifacts from development. Delete them.

---

## 3. High priority — needed for a credible MVP

- [ ] **H1 · Currency is hardcoded to MAD.** `UserProfile.currency` exists in the model but is never read. `fmt()` hardcodes `'fr-MA'` locale and "MAD" is a literal string in 15+ places. Wire the profile field through a `useCurrency()` hook. Blocks every non-Moroccan user.
- [ ] **H2 · No confirmation UI beyond `window.confirm`.** Native browser confirms (page.tsx:417, 1122) look broken inside a PWA/standalone shell. Replace with an in-app confirm sheet.
- [ ] **H3 · No `error.tsx` / `not-found.tsx` / `loading.tsx`.** Any thrown render error shows the raw Next.js error overlay in prod. Add App Router error boundaries.
- [ ] **H4 · Weak form validation.** `parseFloat` with no guards: negative amounts, `NaN`, and absurd values are all accepted. Settings' `parseFloat(total) || month.totalBudget` means entering `0` silently keeps the old value. Add a shared validation layer (Zod recommended).
- [ ] **H5 · Category budgets are per-month copies, not templates.** Editing a category cap only affects the current month; rollover copies whatever the previous month had. Users expect budget caps to be a persistent plan. Consider a user-level `budgetTemplate` doc.
- [ ] **H6 · No data export.** Advertised in the Pro upsell ("Unlimited months, insights, export") but not implemented at any tier. CSV export of expenses is a ~40-line feature and a major trust signal for a finance app.
- [ ] **H7 · No account deletion / data wipe.** GDPR "right to erasure". Also needed for App Store review.
- [ ] **H8 · Google sign-in uses `signInWithPopup` only.** Blocked in iOS in-app browsers (Instagram, LinkedIn webviews) and some Android WebViews. Add `signInWithRedirect` fallback.
- [ ] **H9 · No email verification.** Anyone can register with any address.
- [ ] **H10 · `listMonths()` is dead code.** Defined in `db.ts:73` and never called. Either build the month-history/trends view it was written for, or remove it.
- [ ] **H11 · Accessibility gaps.** `maximumScale: 1, userScalable: false` in `layout.tsx` blocks pinch-zoom (WCAG 1.4.4 failure). No visible focus rings on custom buttons. Icon-only mobile tabs have `aria-label` but modals lack `role="dialog"`, focus trap, and Escape-to-close.

---

## 4. Medium priority — quality & maintainability

- [ ] **M1 · Split `dashboard/page.tsx` (1,281 lines).** Extract to `src/components/modals/*`, `src/components/tabs/*`, `src/components/ui/*`. Currently unreviewable and merge-conflict-prone.
- [ ] **M2 · No linting.** Add `eslint-config-next` + Prettier + a `lint` npm script.
- [ ] **M3 · No tests.** At minimum, unit-test the money math in `store.ts` (`withMoneyPlaceDelta`, `rolloverMonth`, `normalizeMonth`, `buildMonthFromOnboarding`) with Vitest.
- [ ] **M4 · No CI.** Add a GitHub Action running `tsc --noEmit` + `next build` + tests on PR.
- [ ] **M5 · Tailwind is barely used.** Design tokens live in `globals.css` CSS variables while components use inline styles. Move tokens into `tailwind.config.ts` and adopt utility classes, or drop Tailwind. The current split is the worst of both.
- [ ] **M6 · No optimistic-update rollback.** `persist()` sets local state *then* writes to Firestore. On failure it shows an error but leaves the optimistic (wrong) state on screen until the next snapshot.
- [ ] **M7 · Whole-document writes.** Every expense add rewrites the entire month document. At ~200 expenses/month this is wasteful and creates last-write-wins races across two open tabs. Consider a `transactions` subcollection.
- [ ] **M8 · `id`s use `Math.random().toString(36).slice(2,10)`.** ~40 bits of entropy; collision risk is small but non-zero and it's duplicated in two places (`uid` and `uid2`). Use `crypto.randomUUID()`.
- [ ] **M9 · Package name mismatch.** `package.json` says `"budget-tracker"`, the repo is `mybudget-app`, the product is "Flousy". Pick one.
- [ ] **M10 · No `dev`-time env validation.** Missing env vars are handled at runtime but a build-time check would catch misconfigured deploys earlier.
- [ ] **M11 · Google Fonts loaded via CSS `@import`.** Render-blocking. Use `next/font` for self-hosting + zero layout shift.
- [ ] **M12 · No dark mode.** `themeColor` is hardcoded `#FFFFFF`; no `prefers-color-scheme` handling. Token architecture already supports it — it's a ~1 hour change.
- [ ] **M13 · Dependencies drifting.** `next` 14.2.35 → 16.x, `react` 18 → 19, `lucide-react` 0.383 → 1.27, `recharts` 2 → 3, `tailwindcss` 3 → 4. Not urgent, but pin a plan.

---

## 5. Remaining features (not yet built)

### 5a. Feature gaps in what already exists
| Feature | Why it matters |
|---|---|
| Edit expense / fixed charge / goal | ⚠️ **Blocker** — see B1 |
| Withdraw from a saving goal | ⚠️ **Blocker** — see B3 |
| Recurring / auto-repeating fixed charges | Fixed charges must be re-entered manually every month |
| Search & filter transactions | Unusable past ~50 entries/month |
| Multi-month history / trends view | Data is stored; `listMonths()` exists unused |
| Income tracking (multiple income sources) | Only a single `totalBudget` number |
| Transfers between money places | Can't move cash bank → wallet |
| The `person` field on `VariableExpense` | Declared in the type, never written or displayed |
| Attach money place to an expense | See B4 |
| Notes / receipt photo on a transaction | Standard for budget apps |

### 5b. Genuinely new features
| Feature | Effort | Notes |
|---|---|---|
| **Stripe / Lemon Squeezy payments** | L | `plan: 'free' \| 'pro'` is modeled; UI shows a disabled "Soon" button. Needs Checkout + webhook + a server route (would be this app's first non-client code). |
| **Pro feature gating** | M | Nothing currently differs between free and pro. Decide what's gated before wiring payments. |
| **Data export (CSV / JSON)** | S | Also see H6 |
| **Data import** | M | Migration path from spreadsheets — big adoption unlock |
| **Budget alerts / notifications** | M | "You've used 80% of Alimentation" — needs FCM or in-app only |
| **Service worker + offline mode** | M | Manifest exists but there's no SW; the PWA can't work offline today |
| **Analytics** (PostHog / Plausible) | S | Zero product visibility right now |
| **Error monitoring** (Sentry) | S | Errors go to `console.error` and vanish |
| **Multi-currency** | M | See H1 |
| **i18n (FR / AR)** | L | Category names are already French, UI is English. Morocco-targeted app with no Arabic is a real gap. |
| **Shared / household budgets** | L | "Queen"/"King" categories imply couples usage; rules are strictly single-user |
| **Bank sync (Plaid / Tink)** | XL | Post-MVP |
| **Recurring income / payday scheduling** | M | |
| **Debt tracking** | M | |
| **Landing / marketing page** | S | `/` redirects straight to login — nothing explains the product |

---

## 6. Suggested sequencing

### Sprint 1 — Correctness (ship-blocking)
`B1` edit flows → `B2`+`B3` goal money integrity → `B4` money-place decision → `B5` remove fake chart → `H4` validation → `B9` delete `.diff` files

### Sprint 2 — Launch requirements
`B6` legal pages → `B7` rules hardening → `H7` account deletion → `H3` error boundaries → `H8` redirect fallback → `H2` in-app confirms

### Sprint 3 — Product credibility
`H1` currency → `H6` CSV export → `H11` a11y → recurring fixed charges → search/filter → landing page

### Sprint 4 — Engineering hygiene
`M1` split dashboard → `M2` lint → `M3` tests on money math → `M4` CI → analytics + Sentry

### Post-MVP
Payments & Pro gating · offline SW · i18n · shared budgets · trends view · bank sync

---

## 7. Definition of "MVP ready"

- [ ] Every record can be created, **edited**, and deleted
- [ ] Money accounting is internally consistent (no leaks, no fabricated numbers)
- [ ] Privacy Policy + Terms published and linked
- [ ] Users can export and delete all their own data
- [ ] Firestore rules validate shape, not just ownership
- [ ] Errors are caught by boundaries and reported to a monitoring service
- [ ] Currency is not hardcoded
- [ ] `lint` + `build` + `test` run green in CI
