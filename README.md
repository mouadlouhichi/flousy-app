<div align="center">

# 💰 Flousy

**A private, mobile-first budget tracker that knows the difference between
what your money is _for_ and where it actually _is_.**

[![CI](https://img.shields.io/badge/CI-typecheck%20%7C%20lint%20%7C%20test%20%7C%20build-2ea44f)](ci/github-actions-ci.yml)
[![Tests](https://img.shields.io/badge/tests-57%20passing-2ea44f)](#-testing)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)](#-progressive-web-app)

</div>

---

## Table of contents

- [Why Flousy](#-why-flousy)
- [Features](#-features)
- [Quick start](#-quick-start)
- [Firebase setup](#-firebase-setup)
- [Environment variables](#-environment-variables)
- [Scripts](#-scripts)
- [Architecture](#-architecture)
- [Core concepts](#-core-concepts)
- [Data model](#-data-model)
- [Security](#-security)
- [Testing](#-testing)
- [Accessibility](#-accessibility)
- [Progressive Web App](#-progressive-web-app)
- [Deployment](#-deployment)
- [Continuous integration](#-continuous-integration)
- [Privacy & your data](#-privacy--your-data)
- [Roadmap](#-roadmap)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Why Flousy

Most budget apps conflate two different questions:

| Question | Example | Flousy calls it |
| --- | --- | --- |
| What is this money **for**? | Rent is a *need*, dinner out is a *want* | **Budget envelope** |
| Where is this money **sitting**? | In the bank, in a drawer, in my wallet | **Money place** |

Mixing them produces nonsense — like a budgeting rule deciding how much cash
you keep at home. Flousy keeps the two axes strictly separate, and the
accounting honours it: **every dirham is conserved**. Log an expense and the
money leaves a real place. Delete it and it comes back. Fund a savings goal
and it moves out of your account; withdraw and it returns.

That invariant — money is never silently created or destroyed — is enforced
by [57 tests](#-testing).

---

## ✨ Features

### Budgeting
- **Four strategies** — 50/30/20, Zero-Based, Envelope, Pay-Yourself-First.
  Each splits income into **needs / wants / savings** envelopes whose shares
  always sum to exactly 100%.
- **Auto-scaled category budgets.** Your chosen categories are scaled to fill
  their envelope to the dirham. Pick fewer categories and each gets a bigger
  slice — the envelope is never left underspent.
- **Guided onboarding** — income → categories → bills → strategy → review.
- Editable per-category caps and a live **Budget Plan** card tracking spend
  against each envelope.

### Money tracking
- **Three money places** — Bank, Home, Wallet. All income starts in the bank;
  **Move money** transfers between them, always conserving the total.
- Every expense records **which place it was paid from** and debits it.
  Add, edit and delete all reconcile correctly — including when an edit moves
  an expense to a different place.
- **Variable expenses** and **fixed monthly charges** with full
  create / edit / delete, search and category filtering.
- **Saving goals** are global — they survive month rollover — with deposit
  *and* withdraw. Deleting a funded goal **returns its balance** rather than
  vaporising it.
- Month-to-month navigation; a new month inherits your plan with a clean slate
  of transactions.

### Platform
- Email/password and Google sign-in, with **redirect fallback** for in-app
  browsers that block popups, password reset and email verification.
- **12 currencies** (MAD, EUR, USD, GBP, CAD, CHF, AED, SAR, EGP, TND, DZD,
  XOF) with locale-aware formatting.
- **Custom categories** with colour and icon pickers.
- **CSV export** of everything, and **one-click account deletion**.
- Live Firestore sync with **optimistic writes that roll back** on failure.
- **Dark mode**, keyboard-accessible dialogs, installable PWA with an offline
  app shell.

---

## 🚀 Quick start

> **Prerequisites:** Node.js 18+ and a free
> [Firebase](https://console.firebase.google.com) project.

```bash
git clone https://github.com/mouadlouhichi/mybudget-app.git
cd mybudget-app
npm install

cp .env.local.example .env.local   # then fill in your Firebase values
npm run dev
```

Open <http://localhost:3000>.

> [!TIP]
> Missing or incomplete Firebase credentials won't crash the app — `/login`
> and `/dashboard` render a clear "Firebase isn't configured" screen instead.

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

All six are required. They're `NEXT_PUBLIC_*` because the Firebase Web SDK
runs in the browser; this is expected, and access is controlled by security
rules rather than by hiding the config.

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Project settings → Your apps → Web app |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project settings → General |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `<project>.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Web app ID (`1:…:web:…`) |

**Optional**

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_ANALYTICS` | `plausible` or `ga` activates the telemetry seam in `src/lib/analytics.ts`. Unset = nothing is ever sent. |

---

## 📜 Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at localhost:3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest, single run |
| `npm run test:watch` | Vitest, watch mode |
| `npm run format` | Prettier over `src/` |
| **`npm run check`** | **typecheck + lint + test — run before pushing** |

---

## 🏗 Architecture

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Landing page (redirects if signed in)
│   ├── login/                  # Auth: sign in / sign up / reset
│   ├── onboarding/             # 5-step budget setup
│   ├── dashboard/              # Main app shell + state orchestration
│   ├── privacy/  terms/        # Legal pages
│   ├── error.tsx               # Route error boundary
│   ├── global-error.tsx        # Root-layout error boundary
│   ├── not-found.tsx           # 404
│   └── loading.tsx             # Route loading state
│
├── components/
│   ├── ui/                     # Modal, ConfirmDialog, shared primitives
│   ├── modals/                 # Expense, Fixed, Savings, MoveMoney, Settings…
│   └── tabs/                   # Overview, Variable, Fixed, Savings
│
└── lib/
    ├── store.ts                # ⭐ Domain model + all money math (pure)
    ├── db.ts                   # Firestore read/write/subscribe
    ├── auth-context.tsx        # Auth state, sign-in, account deletion
    ├── currency.ts / -context  # 12 currencies + formatting
    ├── validation.ts           # Zod schemas for every form
    ├── export.ts               # CSV generation
    └── analytics.ts            # Telemetry seam (no-op by default)
```

**Design notes**

- **`store.ts` holds all money math as pure functions** with no React or
  Firebase imports. That's why the invariants are cheap to test exhaustively.
- **The dashboard orchestrates; components render.** All Firestore writes flow
  through `persist()` / `persistSavings()`, which apply optimistic updates and
  roll back on failure.
- **Design tokens live in CSS variables** (`globals.css`). Dark mode is a
  token override, so components needed no changes.

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
| Pay Yourself First | 45% | 25% | 30% |

Shares always total 100%, and envelope amounts always sum to your exact
income — the savings envelope absorbs any rounding remainder.

### Category buckets

Each category belongs to `needs` or `wants`. Because a name can mean different
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
| Move money | Debit source, credit destination |

Places clamp at zero and never display a negative balance.

---

## 🗄 Data model

```
users/{uid}                     UserProfile
  ├── plan: 'free' | 'pro'      (rule-protected — clients cannot change it)
  ├── currency: string
  └── onboardingComplete: bool

users/{uid}/months/{YYYY-MM}    MonthBudget
  ├── totalBudget, bankPart, homePart, walletPart
  ├── strategyId, monthlySavingsTarget
  ├── variableExpenses[]        { id, name, amount, type, date, place }
  ├── fixedExpenses[]           { …, base, place }
  ├── variable/fixedCategoryBases
  ├── active…Categories, categoryColors, categoryIcons
  └── updatedAt

users/{uid}/data/savings        SavingsData
  └── goals[]                   { id, name, target, current, source, active }
```

> [!NOTE]
> **Saving goals are global, not per-month.** Money set aside in April is
> still saved in May. Months only ever move money *into* or *out of* a goal —
> they never own it, so nothing resets at rollover.

Documents written by older versions are upgraded on read by
`normalizeMonth()`, which backfills missing fields (including defaulting a
legacy expense's `place` to `bank`).

---

## 🔒 Security

`firestore.rules` enforces ownership **and** document shape:

- ✅ Only `request.auth.uid == uid` can read or write a user's documents
- ✅ Field whitelists — unknown fields are rejected
- ✅ Numeric ranges on every money field (`0 … 1e9`)
- ✅ Array caps: 2,000 variable expenses, 500 fixed, 200 goals
- ✅ 400 KB document ceiling (Firestore's own limit is 1 MiB)
- ✅ Month IDs must match `^[0-9]{4}-[0-9]{2}$`
- ✅ **`plan` is pinned to `'free'`** — a client cannot promote itself to Pro
- ✅ Everything else denied by default

Upgrading a user to Pro must happen server-side via the Admin SDK (which
bypasses rules), driven by a payment webhook.

**Other measures:** Zod validation on every form; CSV-injection neutralisation
in exports; no bank connections and no card details ever collected.

---

## 🧪 Testing

```bash
npm run test
```

**57 tests across 4 suites:**

| Suite | Covers |
| --- | --- |
| `store.test.ts` | Strategy shares, envelope conservation, bucket resolution, spend deltas, goal lifecycle, normalisation, rollover |
| `flows.test.ts` | End-to-end user journeys asserting total cash is conserved |
| `validation.test.ts` | Rejection of empty / `NaN` / `Infinity` / negative / absurd input |
| `export.test.ts` | CSV escaping, injection safety, ordering, empty accounts |

Money math is tested against **all 4 strategies × 5 incomes**, including
rounding-hostile values (`1`, `7`, `12345`, `1000001`), verifying that:

- envelope shares sum to exactly `1`
- envelope amounts sum to exactly the income — no rounding leak
- category budgets fill their envelope **to the dirham**
- add → edit → delete returns to the **exact** starting balance
- fund → withdraw → delete conserves total cash

---

## ♿ Accessibility

- Pinch-zoom **enabled** (the previous `maximum-scale=1` failed WCAG 1.4.4)
- Dialogs: `role="dialog"`, `aria-modal`, focus trap, Escape to close, focus
  restored to the trigger on close, background scroll locked
- Visible `:focus-visible` rings on all interactive elements
- `aria-pressed` / `aria-current` / `aria-expanded` on toggles, tabs and
  accordions; `aria-label` on every icon-only control
- Inline validation errors announced with `role="alert"`
- Full `prefers-reduced-motion` support

---

## 📱 Progressive Web App

Installable on iOS and Android with a manifest, maskable icons and a service
worker that serves an offline page when the network is gone.

**How the install flow works**

| Piece | File | Why it's needed |
| --- | --- | --- |
| Manifest | `public/manifest.json` | Name, `start_url`, `display: standalone`, and 192/512 icons |
| Icons | `public/icon-{192,512}.png`, `icon-maskable-{192,512}.png` | `any` and `maskable` are **separate** entries so Android doesn't crop the logo |
| Service worker | `public/sw.js` | Chrome only offers an install prompt once a worker with a `fetch` handler is active |
| Registration | `src/components/pwa/service-worker-registrar.tsx` | Registers `/sw.js` after `load`, production only |
| Prompt capture | `src/components/pwa/install-prompt-capture.tsx` | Inline `<head>` script that catches `beforeinstallprompt` before React hydrates |
| Install UI | `install-button.tsx`, `install-banner.tsx`, `ios-install-sheet.tsx` | Header button, auto banner, and manual iOS instructions |

Anything that needs install state can use the `usePwaInstall()` hook:

```ts
const { canInstall, isInstalled, isIos, promptInstall } = usePwaInstall();
```

> [!IMPORTANT]
> The service worker **deliberately never caches Firestore or Auth traffic.**
> Showing stale financial data would be worse than an honest offline state,
> and the Firebase SDK has its own offline persistence. It also only registers
> in production, so it can't serve stale bundles during development.

> [!NOTE]
> `beforeinstallprompt` only fires over **HTTPS** (or `localhost`), and never in
> Firefox or on iOS. iOS Safari users get the "Add to Home Screen" sheet instead.
> Chrome also won't re-prompt an app that is already installed.

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
- [ ] Fill in the operating entity and governing jurisdiction placeholders in
      `/privacy` and `/terms`
- [ ] Optionally set `NEXT_PUBLIC_ANALYTICS` and add the provider script

---

## 🔄 Continuous integration

The workflow runs **typecheck → lint → test → build** on every push and PR.

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

## 🗺 Roadmap

**Shipped** — edit everywhere · money-place accounting · goal withdrawals ·
real spend trajectory · legal pages · CSV export · account deletion ·
hardened rules · 12 currencies · dark mode · offline shell · CI · 57 tests

**Next**

| Feature | Effort | Notes |
| --- | --- | --- |
| Stripe / Lemon Squeezy payments | L | `plan` field exists and is rule-protected; needs Checkout + Admin SDK webhook |
| Recurring fixed charges | M | Bills are re-entered each month today |
| Multi-month trends view | M | Data and `listMonths()` already available |
| CSV import | M | Migration path from spreadsheets |
| Budget alerts | M | "You've used 80% of Alimentation" |
| i18n (FR / AR) | L | UI is English while default categories are French |
| Shared / household budgets | L | Rules are strictly single-user today |
| Bank sync (Plaid / Tink) | XL | Post-MVP |

**Known limitations**

- Whole-document writes per month — fine to ~2,000 transactions/month
  (rule-enforced); a `transactions` subcollection is the fix if needed
- Rules validate shape and size but don't rate-limit writes
- Styling mixes Tailwind utilities with inline styles and CSS variables

See [`MVP_TODO.md`](MVP_TODO.md) for the full audit.

---

## 🔧 Troubleshooting

<details>
<summary><strong>"Firebase isn't configured"</strong></summary>

One or more of the six `NEXT_PUBLIC_FIREBASE_*` variables is missing. Check
`.env.local` and **restart the dev server** — Next.js only reads env files at
startup.
</details>

<details>
<summary><strong>Data won't load, or writes silently fail</strong></summary>

Almost always undeployed security rules:

```bash
firebase deploy --only firestore:rules
```

Otherwise check the browser console for `permission-denied`.
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
back in, and retry. Google accounts re-authenticate inline.
</details>

<details>
<summary><strong>Build fails fetching fonts</strong></summary>

Fonts load via `<link>` at runtime, not `next/font` (which fetches from Google
at build time and breaks on restricted networks). If you see a *"Failed to
download the stylesheet"* warning, the build still succeeds — fonts simply
fall back to system faces offline.
</details>

---

<div align="center">
<sub>Built with Next.js, Firebase and TypeScript.</sub>
</div>
