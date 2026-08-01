<div align="center">

# 💰 SmartJib

**A private, mobile-first budget tracker that knows the difference between
what your money is _for_ and where it actually _is_.**

[![CI](https://img.shields.io/badge/CI-typecheck%20%7C%20lint%20%7C%20test%20%7C%20build-2ea44f)](ci/github-actions-ci.yml)
[![Tests](https://img.shields.io/badge/tests-86%20passing-2ea44f)](#-testing)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)](#-progressive-web-app)

</div>

---

## Table of contents

- [Why SmartJib](#-why-flousy)
- [Features](#-features)
- [Tech stack](#-tech-stack)
- [Quick start](#-quick-start)
- [Firebase setup](#-firebase-setup)
- [Environment variables](#-environment-variables)
- [Scripts](#-scripts)
- [Project structure](#-project-structure)
- [Core concepts](#-core-concepts)
- [Data model](#-data-model)
- [Internationalisation](#-internationalisation)
- [Security](#-security)
- [Testing](#-testing)
- [Progressive Web App](#-progressive-web-app)
- [SEO & discoverability](#-seo--discoverability)
- [Deployment](#-deployment)
- [Continuous integration](#-continuous-integration)
- [Privacy & your data](#-privacy--your-data)
- [Roadmap & known limitations](#-roadmap--known-limitations)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Why SmartJib

Most budget apps conflate two different questions:

| Question | Example | SmartJib calls it |
| --- | --- | --- |
| What is this money **for**? | Rent is a *need*, dinner out is a *want* | **Budget envelope** |
| Where is this money **sitting**? | In the bank, in a drawer, in my wallet | **Money place** |

Mixing them produces nonsense — like a budgeting rule deciding how much cash
you keep at home. SmartJib keeps the two axes strictly separate, and the
accounting honours it: **every dirham is conserved**. Log an expense and the
money leaves a real place. Delete it and it comes back. Fund a savings goal
and it moves out of your account; withdraw and it returns.

That invariant — money is never silently created or destroyed — is enforced by
the [test suite](#-testing).

SmartJib **never connects to your bank**. You enter transactions yourself, which
is the whole point: no credentials, no third-party aggregator, no card numbers.

---

## ✨ Features

### Budgeting

- **Four strategies** — 50/30/20, Zero-Based, Envelope, Pay-Yourself-First.
  Each splits income into **needs / wants / savings** envelopes whose shares
  always sum to exactly 100%.
- **Auto-scaled category budgets.** Active categories are distributed across
  their envelope down to the last currency unit, with the remainder spread one
  unit at a time so nothing is left unallocated.
- **Guided 5-step onboarding** — income → categories → bills → strategy → review.
- **Multiple income sources** — name and track each stream separately; the
  month's total budget is their sum.
- **Budget alerts** — a notification tray flags envelopes at 80% / 100% of
  their cap, plus any single category eating >60% of variable spending.

### Money tracking

- **Three money places** — Bank, Home, Wallet. All income starts in the bank;
  **Move money** transfers between them, always conserving the total.
- Every expense records **which place it was paid from** and debits it.
  Add, edit and delete all reconcile correctly — including when an edit moves
  an expense to a different place.
- **Variable expenses** and **fixed monthly bills** with full create / edit /
  delete, search, and category + person filtering.
- **Recurring bills** carry over automatically when you open a fresh month.
- **Saving goals** are global — they survive month rollover — with deposit
  *and* withdraw. Deleting a funded goal **returns its balance** rather than
  vaporising it.
- **Debts & credits** ledger — track what you owe and what's owed to you, and
  toggle each entry between open and settled.
- **Trends** — month-over-month spending comparison, category breakdown,
  per-person (household) breakdown, income-source analytics, and budget health,
  over the last 6 months.
- Month-to-month navigation; a new month inherits your plan with a clean slate
  of transactions.

### Platform

- Email/password and Google sign-in, with **redirect fallback** for in-app
  browsers that block popups, plus password reset and email verification.
- **Demo mode** — the app runs entirely on `localStorage` when Firebase isn't
  configured, so you can explore it without a backend.
- **12 currencies** (MAD, EUR, USD, GBP, CAD, CHF, AED, SAR, EGP, TND, DZD,
  XOF) with locale-aware `Intl` formatting.
- **3 languages** — English, French and Arabic, including **RTL** layout.
- **Custom categories** with colour and icon pickers.
- **CSV export** of everything, **CSV import** of transactions, and
  **one-click account deletion**.
- Live Firestore sync with a local cache, so the UI stays responsive and
  survives a reload.
- **Light / dark / system** theme, and an installable PWA with an offline shell.
- Marketing site included: landing page, blog, help, about, contact, careers
  and legal pages, with JSON-LD, sitemap, robots and `llms.txt`.

---

## 🧰 Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 15** (App Router, React 19, TypeScript) |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`) + CSS-variable design tokens |
| UI primitives | **shadcn/ui** (new-york) on Radix, **lucide-react** icons |
| Backend | **Firebase** Auth + Firestore (client SDK only — no server) |
| Validation | **Zod** |
| Charts | **Recharts** |
| Tests | **`node:test`** via **tsx** (no test framework dependency) |

> [!NOTE]
> There is no custom server and no API routes. Firestore security rules are the
> authorisation layer, which is why [deploying them](#-firebase-setup) is not
> optional.

---

## 🚀 Quick start

> **Prerequisites:** Node.js 20+ (CI pins 20) and — optionally — a free
> [Firebase](https://console.firebase.google.com) project.

```bash
git clone https://github.com/mouadlouhichi/flousy-app.git
cd flousy-app
npm install

cp .env.example .env.local   # then add your Firebase values (see below)
npm run dev
```

Open <http://localhost:3000>.

> [!TIP]
> **No Firebase? No problem.** Without credentials the app falls back to
> **Demo Mode**: `/login` offers a "Continue in Demo Mode" button and all data
> is kept in `localStorage`. Nothing crashes, nothing syncs.

---

## 🔥 Firebase setup

<details>
<summary><strong>Step-by-step (click to expand)</strong></summary>

1. **Create a project** at <https://console.firebase.google.com>.

2. **Enable authentication**
   Authentication → Sign-in method → enable **Email/Password** and **Google**.

3. **Create the database**
   Firestore Database → Create database. Production mode is correct — the
   rules in this repo replace the defaults.

4. **Register a web app**
   Project settings → General → *Your apps* → add a **Web app**, then copy the
   six config values into `.env.local`.

5. **Deploy the security rules** ← *don't skip this*

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add          # pick your project
   firebase deploy --only firestore:rules
   ```

</details>

> [!WARNING]
> **Always deploy `firestore.rules`.** Without it, Firestore either blocks
> every read/write (the app looks broken) or — if you picked *test mode* —
> lets **anyone read and write anyone's financial data**. See
> [Security](#-security) for what the rules enforce.

---

## 🔑 Environment variables

The six Firebase values are what the app actually reads at runtime. They're
`NEXT_PUBLIC_*` because the Firebase Web SDK runs in the browser; this is
expected, and access is controlled by security rules rather than by hiding the
config. Each also accepts a non-prefixed fallback (e.g. `FIREBASE_API_KEY`).

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Project settings → Your apps → Web app |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project settings → General |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `<project>.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Web app ID (`1:…:web:…`) |

Only `apiKey` and `projectId` are strictly required for Firebase to initialise;
omit them and the app runs in Demo Mode.

**Optional**

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_ANALYTICS` | `plausible` or `ga` activates the telemetry seam in `src/lib/analytics.ts`. Unset = nothing is ever sent. |

The committed `.env.example` also lists `GEMINI_API_KEY` and `APP_URL`, which
are injected by the AI Studio host environment. Neither is read by the app
today.

---

## 📜 Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on `0.0.0.0:3000` (via `scripts/dev.js`) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run clean` | Remove `.next` and `dist` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Currently an alias of `typecheck` — see [known limitations](#-roadmap--known-limitations) |
| `npm run test` | `tsx --test tests/*.test.ts` |
| **`npm run check`** | **typecheck + lint + test — run before pushing** |

---

## 🏗 Project structure

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Marketing landing page
│   ├── login/                  # Auth: sign in / sign up / reset / demo
│   ├── onboarding/             # 5-step budget setup
│   ├── dashboard/              # Main app shell + state orchestration
│   ├── blog/  help/  about/    # Content & support pages
│   ├── contact/  careers/
│   ├── privacy/  terms/ cookies/
│   ├── opengraph-image.tsx     # Generated OG image
│   ├── sitemap.ts  robots.ts   # SEO route handlers
│   ├── error.tsx               # Route error boundary
│   ├── not-found.tsx           # 404
│   └── loading.tsx             # Route loading state
│
├── components/
│   ├── ui/                     # shadcn/ui primitives + Modal, ConfirmDialog…
│   ├── modals/                 # Expense, Fixed, Savings, MoveMoney, Debt,
│   │                           #   Settings, Categories, ImportCsv, Income, Pro
│   ├── tabs/                   # Overview, Variable, Fixed, Savings, Trends, Debts
│   ├── landing/                # Marketing sections
│   ├── pwa/                    # Install prompt, banner, SW registrar
│   └── seo/                    # JSON-LD helper
│
├── lib/
│   ├── store.ts                # ⭐ Domain model + all money math (pure)
│   ├── db.ts                   # Firestore read/write/subscribe
│   ├── auth-context.tsx        # Auth state, sign-in, account deletion
│   ├── currency.ts / -context  # 12 currencies + formatting
│   ├── i18n*.ts(x)             # en/fr/ar, RTL, ICU plurals
│   ├── validation.ts           # Zod schemas for every form
│   ├── export.ts               # CSV generation
│   ├── payments.ts             # Mock Stripe checkout
│   ├── blog.ts  seo.ts         # Content + SEO constants
│   └── analytics.ts            # Telemetry seam (no-op by default)
│
├── hooks/                      # use-pwa-install, use-mobile, use-toast
└── middleware.ts               # Per-request nonce-based CSP

messages/                       # en.json · fr.json · ar.json
tests/                          # node:test suites
ci/                             # GitHub Actions workflow (see CI section)
firestore.rules                 # Authorisation layer
```

**Design notes**

- **`store.ts` holds all money math as pure functions** — zero imports, no
  React, no Firebase. That's why the invariants are cheap to test exhaustively.
- **The dashboard orchestrates; components render.** Writes go through
  `updateAndSaveMonth()` / `updateAndSaveGoals()`, which update React state,
  mirror to `localStorage`, then persist to Firestore when signed in.
- **Design tokens live in CSS variables** (`src/index.css`, documented in
  [`DESIGN.md`](DESIGN.md)). Dark mode is a token override, so components
  needed no changes.

---

## 🧠 Core concepts

### Envelopes vs money places

```
INCOME  ─┬─► envelopes  (what it's FOR)    needs · wants · savings
         └─► places     (where it IS)      bank  · home  · wallet
```

These are **independent**. A strategy sets envelope *shares*; it never decides
placement. All income starts in the **bank**, and you move cash out explicitly.

### Strategies

| Strategy | Needs | Wants | Savings |
| --- | --- | --- | --- |
| 50/30/20 Rule *(default)* | 50% | 30% | 20% |
| Zero-Based Budgeting | 60% | 25% | 15% |
| Envelope System | 55% | 35% | 10% |
| Pay-Yourself-First | 45% | 25% | 30% |

Shares always total 100%, and envelope amounts always sum to your exact
income — the savings envelope absorbs any rounding remainder.

### Category buckets

Each category resolves to `needs` or `wants`. Because a name can mean different
things in different contexts, buckets are resolved **per kind**:

```ts
bucketOf('Autre', 'variable')  // → 'wants'  (a miscellaneous purchase)
bucketOf('Autre', 'fixed')     // → 'needs'  (a miscellaneous recurring bill)
```

Unknown custom categories default to `wants` for variable spending and `needs`
for fixed bills, so a user-invented category can never quietly inflate the
essentials envelope.

### Money conservation

Every operation that touches money is reversible and balanced:

| Action | Effect |
| --- | --- |
| Add expense | Debit its money place |
| Edit amount | Apply only the **difference** |
| Edit place | Refund the old place, debit the new one |
| Delete expense | Refund in full |
| Fund goal | Debit place → increase goal |
| Withdraw goal | Decrease goal → credit place |
| Delete funded goal | **Return the balance** to its place |
| Move money | Debit source, credit destination (capped at the source balance) |

Places clamp at zero and never display a negative balance.

---

## 🗄 Data model

```
users/{uid}                     UserProfile
  ├── plan: 'free' | 'pro'      (rule-protected — clients cannot change it)
  ├── currency: string
  ├── onboardingComplete: bool
  ├── displayName?, theme?
  ├── language?: 'en' | 'fr' | 'ar'
  └── householdMembers?: string[]

users/{uid}/months/{YYYY-MM}    MonthBudget
  ├── totalBudget, incomeSources[]
  ├── bankPart, homePart, walletPart
  ├── strategyId, monthlySavingsTarget
  ├── variableExpenses[]        { id, name, amount, type, date, place,
  │                               note?, person?, tags?, receiptUrl? }
  ├── fixedExpenses[]           { …, base?, recurring?, person? }
  ├── debts[]                   { id, name, amount, type, status, date, note? }
  ├── variable/fixedCategoryBases
  ├── activeCategories, categoryColors, categoryIcons
  └── updatedAt

users/{uid}/data/savings        SavingsData
  └── goals[]                   { id, name, target, current, source, active }
```

> [!NOTE]
> **Saving goals are global, not per-month.** Money set aside in April is
> still saved in May. Months only ever move money *into* or *out of* a goal —
> they never own it, so nothing resets at rollover.

Documents written by older versions are upgraded on read by `normalizeMonth()`,
which backfills missing fields (including defaulting a legacy expense's `place`
to `bank`). A machine-readable schema lives in
[`firebase-blueprint.json`](firebase-blueprint.json) — it covers every entity
plus the nested item shapes (expenses, goals, debts, income sources).

Nothing reads that file at runtime, so [`tests/blueprint.test.ts`](tests/blueprint.test.ts)
keeps it honest: it parses `src/lib/store.ts` with the TypeScript compiler and
fails the build if the blueprint's fields, `required` list, string-literal enums
or array element types drift from the interfaces. It also cross-checks the
document paths against `src/lib/db.ts` and the month-ID pattern, array caps and
money bounds against `firestore.rules`. **Change a type — update the blueprint.**

---

## 🌍 Internationalisation

Three locales ship fully translated: **English**, **French**, **Arabic**.

- Messages live in [`messages/`](messages) as flat JSON, typed from `en.json`
  so a missing key in a translation is a type error.
- `formatMessage()` supports `{token}` interpolation and **ICU plurals**
  (`=0 / one / two / few / many / other`), which matters for Arabic.
- Arabic sets `dir="rtl"` on `<html>`; the locale is resolved server-side from
  the `flousy_language` cookie so the first paint is already correct.
- Language choice persists to the cookie, `localStorage`, **and** the user
  profile in Firestore.
- Default category names are localised per language.

---

## 🔒 Security

`firestore.rules` enforces ownership and basic document shape:

- ✅ Only `request.auth.uid == uid` can read or write a user's documents
- ✅ Everything else **denied by default** (`match /{document=**}`)
- ✅ Money fields validated as numbers in `0 … 1e9`
- ✅ Array caps: 2,000 variable expenses, 500 fixed, 200 goals
- ✅ Month IDs must match `^[0-9]{4}-[0-9]{2}$`
- ✅ **`plan` is pinned** — a client cannot promote itself to Pro
- ✅ Profile creation requires `plan == 'free'`

Upgrading a user to Pro must happen server-side via the Admin SDK (which
bypasses rules), driven by a payment webhook.

**Other measures**

- **Nonce-based CSP** generated per request in `src/middleware.ts`
  (`strict-dynamic` in production), which is why the root layout is
  `force-dynamic`.
- Hardened response headers in `next.config.mjs`: HSTS, `nosniff`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and
  `COOP: same-origin-allow-popups` so Google sign-in popups still work.
- **Zod validation** on every form.
- **CSV-injection neutralisation** on export (`=`, `+`, `-`, `@`, tab, CR are
  prefixed with `'`).
- No bank connections, and card details are never collected — the Pro checkout
  is a [mock](#-roadmap--known-limitations).

---

## 🧪 Testing

```bash
npm run test
```

**86 tests across 18 suites**, run by Node's built-in test runner through `tsx`:

| Suite | Tests | Covers |
| --- | --- | --- |
| `store.test.ts` | 8 | Strategy shares, envelope conservation, bucket resolution, category distribution, expense/goal lifecycles, normalisation |
| `pwa.test.ts` | 16 | Manifest fields, icons on disk, maskable separation, service-worker behaviour, install-prompt wiring |
| `validation.test.ts` | 6 | Rejection of empty / `NaN` / `Infinity` / negative / absurd input |
| `export.test.ts` | 3 | CSV escaping, injection safety, ordering, empty accounts |
| `seo.test.ts` | 3 | Currency/strategy facts stay aligned across `seo.ts`, `llms.txt` and the sitemap |
| `flows.test.ts` | 1 | A full monthly journey asserting total wealth is conserved end to end |
| `household.test.ts` | 11 | Household RBAC permissions (`owner`, `editor`, `contributor`, `viewer`, `custom`), Pro upgrade visibility gating, storage key namespacing, and audit trail helpers |

Money math is tested against **all 4 strategies × 5 incomes**, including
rounding-hostile values (`1`, `7`, `12345`, `1000001`), verifying that:

- envelope shares sum to exactly `1`
- envelope amounts sum to exactly the income — no rounding leak
- category budgets fill their envelope **to the last unit**
- add → edit → delete returns to the **exact** starting balance
- fund → withdraw → delete conserves total cash

---

## 📱 Progressive Web App

Installable on iOS and Android with a manifest, maskable icons and a service
worker that serves an offline page when the network is gone.

**How the install flow works**

| Piece | File | Why it's needed |
| --- | --- | --- |
| Manifest | `public/manifest.json` | Name, `start_url: /dashboard`, `display: standalone`, 192/512 icons |
| Icons | `public/icon-{192,512}.png`, `icon-maskable-{192,512}.png` | `any` and `maskable` are **separate** entries so Android doesn't crop the logo |
| Service worker | `public/sw.js` | Chrome only offers an install prompt once a worker with a `fetch` handler is active |
| Registration | `src/components/pwa/service-worker-registrar.tsx` | Registers `/sw.js` after `load`, production only |
| Prompt capture | `src/components/pwa/install-prompt-capture.tsx` | Inline `<head>` script that catches `beforeinstallprompt` before React hydrates |
| Install UI | `install-button.tsx`, `install-banner.tsx`, `ios-install-sheet.tsx` | Header button, auto banner, and manual iOS instructions |

Anything that needs install state can use the `usePwaInstall()` hook:

```ts
const { canInstall, isInstalled, isIos, isPrompting, promptInstall, dismiss } =
  usePwaInstall();
```

A dismissed banner stays hidden for two weeks.

> [!IMPORTANT]
> The service worker **deliberately never caches Firestore or Auth traffic**,
> nor anything cross-origin or non-`GET`. Showing stale financial data would be
> worse than an honest offline state, and the Firebase SDK has its own offline
> persistence. Navigations are network-first with an offline fallback; static
> assets are stale-while-revalidate.

> [!NOTE]
> `beforeinstallprompt` only fires over **HTTPS** (or `localhost`), and never in
> Firefox or on iOS. iOS Safari users get the "Add to Home Screen" sheet instead.
> Chrome also won't re-prompt an app that is already installed.

---

## 🔎 SEO & discoverability

- Per-page `metadata` with Open Graph and Twitter cards, plus a generated
  `/opengraph-image`.
- **JSON-LD** for `SoftwareApplication`, `Organization` and the landing FAQ.
- `sitemap.ts` publishes public routes and **excludes** `/dashboard`,
  `/onboarding` and `/login`; `robots.ts` disallows the same.
- `public/llms.txt` gives AI crawlers a factual summary — and `seo.test.ts`
  fails the build if it drifts from the app's real currency and strategy lists.
- Three long-form budgeting guides under `/blog`.

---

## 🚢 Deployment

Standard Next.js app — deploy to [Vercel](https://vercel.com) (recommended),
Netlify, or any Node host.

```bash
vercel
```

**Pre-flight checklist**

- [ ] Set the six `NEXT_PUBLIC_FIREBASE_*` variables in your host's dashboard
- [ ] `firebase deploy --only firestore:rules`
- [ ] Add your production domain to **Firebase → Authentication → Settings →
      Authorized domains** (otherwise sign-in is rejected)
- [ ] Point `SITE_URL` in `src/lib/seo.ts` at your domain
- [ ] Fill in the operating entity and governing jurisdiction placeholders in
      `/privacy` and `/terms`
- [ ] Optionally set `NEXT_PUBLIC_ANALYTICS` and add the provider script

> [!NOTE]
> The root layout is `force-dynamic` (required by the per-request CSP nonce), so
> pages are rendered on demand rather than statically exported.

---

## 🔄 Continuous integration

The workflow runs **typecheck → lint → test → build** on every push and PR,
using Node 20 and dummy Firebase values so the build never needs real
credentials.

It ships at [`ci/github-actions-ci.yml`](ci/github-actions-ci.yml) rather than
in `.github/workflows/` because the GitHub App used to push this branch lacks
the `workflows` permission. To activate:

```bash
mkdir -p .github/workflows
git mv ci/github-actions-ci.yml .github/workflows/ci.yml
git commit -m "ci: enable GitHub Actions workflow"
git push
```

---

## 🛡 Privacy & your data

- Your budget data is **private to your account** and is never sold or shared
- **No bank connections.** Card and account numbers are never requested
- **No third-party tracking** — analytics are opt-in and off by default
- **Export** everything as CSV from Settings at any time
- **Delete** your account and all data from Settings; this clears every
  subcollection, the profile document and the auth record

---

## 🗺 Roadmap & known limitations

**Shipped** — money-place accounting · edit everywhere · goal withdrawals ·
debts & credits · multi-month trends · recurring bills · budget alerts ·
income sources · CSV export *and* import · household/person tracking ·
shared household workspaces & RBAC · 12 currencies · en/fr/ar with RTL ·
light/dark themes · offline shell · nonce CSP · hardened rules ·
marketing site & blog · CI · 84 tests · mock Pro checkout

**Next**

| Feature | Effort | Notes |
| --- | --- | --- |
| Real payments (Stripe / Lemon Squeezy) | L | Mock checkout UI is complete in `payments.ts`; needs live Checkout + an Admin SDK webhook to flip `plan` |
| Move receipts to Firebase Storage | M | Currently stored as base64 data URLs inside the month document |
| JSON backup export | S | CSV only right now |
| Month locking / archiving | M | No concept of a "closed" month |
| Push notifications | M | No infrastructure yet |
| Bank sync (Plaid / Tink) | XL | Post-MVP, and at odds with the no-connection promise |

**Known limitations**

- Whole-document writes per month — fine to ~2,000 transactions/month
  (rule-enforced); a `transactions` subcollection is the fix if needed
- `npm run lint` is aliased to `tsc --noEmit`; **ESLint is not wired up**
- Rules validate shape and size but don't rate-limit writes, and auth emails
  aren't rate-limited either
- IDs are generated with `Math.random()`; `crypto.randomUUID()` would be safer
- Styling mixes Tailwind utilities with inline styles and CSS variables
- Accessibility is partial: dialogs set `role="dialog"` / `aria-modal`, move
  focus in and restore it on close, lock scroll and close on Escape, and
  inline errors use `role="alert"` — but there's no focus trap, no
  `prefers-reduced-motion` handling, and icon-only controls are only partly
  labelled

See [`MVP_TODO.md`](MVP_TODO.md) for the full feature-by-feature audit.

---

## 🔧 Troubleshooting

<details>
<summary><strong>The app says "Demo Mode" and nothing syncs</strong></summary>

Firebase didn't initialise — at minimum `NEXT_PUBLIC_FIREBASE_API_KEY` and
`NEXT_PUBLIC_FIREBASE_PROJECT_ID` must be set. Check `.env.local` and
**restart the dev server**; Next.js only reads env files at startup.
</details>

<details>
<summary><strong>Data won't load, or writes silently fail</strong></summary>

Almost always undeployed security rules:

```bash
firebase deploy --only firestore:rules
```

Otherwise check the browser console — `db.ts` logs a detailed
`Firestore Error Details` object including the path and operation.
</details>

<details>
<summary><strong>Google sign-in does nothing</strong></summary>

- Add your domain under **Authentication → Settings → Authorized domains**
- In in-app browsers (Instagram, LinkedIn) popups are blocked; the app detects
  this and falls back to redirect automatically
</details>

<details>
<summary><strong>"requires-recent-login" when deleting an account</strong></summary>

Firebase requires a fresh credential for destructive actions. Sign out, sign
back in, and retry.
</details>

<details>
<summary><strong>Build fails fetching fonts</strong></summary>

`src/app/layout.tsx` loads Instrument Sans and JetBrains Mono via
`next/font/google`, which downloads them **at build time**. On a network that
blocks `fonts.googleapis.com` the build fails with `ECONNRESET`. Build with
network access, or swap the fonts for local files / a runtime `<link>`.
</details>

<details>
<summary><strong>A style change isn't showing up</strong></summary>

Three CSS files exist but only `src/index.css` is imported by the root layout.
`src/app/globals.css` and `src/styles/globals.css` are currently unused.
</details>

---

<div align="center">
<sub>Built with Next.js, Firebase and TypeScript.</sub>
</div>
