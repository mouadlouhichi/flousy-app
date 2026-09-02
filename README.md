<div align="center">

# 💰 SmartJib

**A private, mobile-first budget tracker that separates what money is for from where it is held.**

[![CI definition](https://img.shields.io/badge/CI-definition_available-2ea44f)](ci/github-actions-ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)

</div>

> **Release status:** repository work for the production candidate is tracked in
> [`MVP_TODO.md`](MVP_TODO.md). Deployment credentials, DNS/email verification,
> monitoring, App Check and live smoke tests are operator-owned gates in
> [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md).

## Contents

- [Why SmartJib](#why-smartjib)
- [Launch plans](#launch-plans)
- [Features](#features)
- [Architecture and trust boundaries](#architecture-and-trust-boundaries)
- [Quick start](#quick-start)
- [Firebase setup](#firebase-setup)
- [Environment variables](#environment-variables)
- [Commands and validation](#commands-and-validation)
- [Data model](#data-model)
- [Internationalisation](#internationalisation)
- [Privacy and security](#privacy-and-security)
- [Deployment](#deployment)
- [Continuous integration](#continuous-integration)
- [Known constraints and post-launch work](#known-constraints-and-post-launch-work)

## Why SmartJib

Most budget apps conflate two independent questions:

| Question | Example | SmartJib concept |
| --- | --- | --- |
| What is this money **for**? | Rent is a need; dinner out is a want | Budget envelope |
| Where is this money **held**? | Bank, home or wallet | Money place |

SmartJib keeps those axes separate. Expense edits, transfers, savings deposits,
withdrawals and deletion flows are built around conservation of money rather
than silently changing the total. SmartJib does **not** connect to bank accounts:
transactions are entered manually and no bank credentials or account numbers
are requested.

## Launch plans

### Free

The core budget is free with no time limit. It includes manual income and expense
tracking, money places and transfers, fixed charges, saving goals, debts and
credits, month navigation, data export/backup and account deletion.

### Pro launch trial

An eligible account can start **one 90-day Pro trial**:

- no card or payment details are collected;
- there is no paid checkout at launch;
- the trial does not renew automatically;
- access expires exactly 90 days after the recorded start time;
- core data remains available when Pro editing expires.

Pro currently unlocks:

- barcode-assisted shopping-course entry;
- six-month trends and analytics views;
- multiple income-source management;
- bulk CSV import;
- category caps and budget rollover;
- shared Household workspaces.

CSV export and complete JSON backup remain available from **Profile → Data** as
data-portability features; they are not paywalled.

`src/lib/pro-features.ts` resolves expiry-aware access. Firestore Rules permit a
client account to claim only the one exact launch-trial window and prevent it
from rewriting entitlement fields afterward. Household access is projected from
an actively entitled owner and enforced in Rules.

### Future billing (disabled)

`src/lib/payments.ts` is a provider-neutral contract for a later **Moroccan CMI
or Stripe** integration. `BILLING_LIVE` is `false`; there are no provider
credentials, live payment endpoints, recurring offers or in-app card fields.
The future implementation must use provider-hosted checkout, signature-verified
and idempotent webhooks, and Firebase Admin SDK entitlement projection. Browser
code must never grant a paid entitlement.

## Features

### Budgeting and accounting

- Four strategies: 50/30/20, zero-based, envelope and pay-yourself-first.
- Needs, wants and savings envelopes with exact remainder handling.
- Configurable variable and fixed categories, icons and colours.
- Bank, home, wallet and custom money places.
- Add, edit and delete variable expenses and fixed charges.
- Place-to-place transfers, balance adjustments and immutable audit entries.
- Global saving goals with deposit, withdrawal and safe funded-goal deletion.
- Debts and credits with open/settled lifecycle.
- Recurring income and fixed-charge materialisation without duplicate retries.
- Configurable budget-month start day and historical currency snapshots.
- Personal and owner-controlled Household month close/reopen; closed periods are
  read-only across ordinary edits, course posting and invoice approval.

### Household collaboration

- Owner, editor, viewer and contributor roles enforced by Firestore Rules.
- Area-aware navigation, reads, edits and exports.
- Secure invitation documents with expiring codes.
- Optional Resend delivery; a valid code remains usable if email delivery is not
  configured.
- Contributor invoice submission and transactional owner approval/rejection.
- Member attribution, audit metadata and owner-only lifecycle controls.

### Shopping-course capture

- Manual product entry is always available.
- Pro barcode scan path: native `BarcodeDetector`, then ZXing fallback.
- Product resolution: private catalog, Open Food Facts, then manual fallback.
- Quantity and price capture, deterministic bill text/CSV, sharing and history.
- Idempotent posting of a completed course into an open budget month.
- Barcode lookup failures degrade to manual entry rather than blocking a trip.

See [`COURSE_SESSION_DESIGN.md`](COURSE_SESSION_DESIGN.md) for the design and
privacy decisions.

### Data ownership and resilience

- Current-month CSV export with spreadsheet-injection neutralisation.
- Localised CSV import with delimiter/header mapping, duplicate detection and
  bounded batch sizes (Pro).
- Complete, versioned JSON workspace backup and confirmation-gated restore.
- Personal deletion, account deletion and Household leave/delete flows that
  report partial failure instead of claiming success.
- Local month cache plus an IndexedDB-backed mutation outbox.
- Transactional Firestore revisions, stable mutation IDs and conflict recovery.
- Backward-compatible normalisation for legacy month/profile documents.

### Platform

- Firebase email/password and Google sign-in, password reset and email
  verification.
- Local-only demo mode when Firebase is absent or explicitly selected.
- 12 currencies: MAD, EUR, USD, GBP, CAD, CHF, AED, SAR, EGP, TND, DZD and XOF.
- English, French and Arabic UI, including RTL layout.
- Responsive dashboard, light/dark/system theme and installable PWA shell.
- Public landing, blog, about, help, contact, careers and legal pages.
- Sitemap, robots, Open Graph image, factual `llms.txt` and JSON-LD.

## Architecture and trust boundaries

| Layer | Implementation |
| --- | --- |
| Web | Next.js 16 App Router, React 19, TypeScript 5.8 |
| Styling | Tailwind CSS 4, CSS design tokens, Radix/shadcn primitives |
| Identity/data | Firebase Authentication and Cloud Firestore |
| Server routes | Next.js Node runtime for contact, invitation email and barcode proxy |
| Email | Resend, configured only with server-side variables |
| Validation | Zod plus domain validation and Firestore Rules |
| Charts | Responsive semantic HTML/CSS trend and breakdown visualizations |
| Tests | Node test runner through `tsx`; Firebase Rules Unit Testing for emulator cases |

The browser is not trusted as an authorisation boundary. Firestore Rules enforce
ownership, active Household membership/role, entitlement projection, create-only
onboarding bootstraps, period state, monotonic revisions and matching immutable
ledger entries. Multi-document finance transitions use Firestore transactions.
Friendly UI gates are defense in depth, not the source of authority.

The three server routes have intentionally narrow responsibilities:

- `GET/POST /api/contact`: readiness plus validated, same-origin, rate-limited,
  idempotent contact submission with truthful provider-acceptance status;
- `GET/POST /api/household-invitations`: no-secret readiness plus authenticated
  delivery of an invitation already authorised by Firestore Rules;
- `GET /api/barcode/lookup`: bounded Open Food Facts proxy/fallback.

Financial records are read and written directly through Firebase; they are not
sent through the email or barcode routes.

## Quick start

### Prerequisites

- **Node.js 24** recommended (matches CI and the current ZXing dependency engine).
- npm (lockfile is committed).
- For Rules tests/deployment: Java 21 and Firebase CLI 15.
- Optional Firebase project; without Firebase configuration the app can run in
  local demo mode.

```bash
git clone https://github.com/mouadlouhichi/flousy-app.git
cd flousy-app
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. `npm run dev` binds to `0.0.0.0:3000`.

## Firebase setup

1. Create a Firebase project.
2. Enable **Email/Password** and **Google** under Authentication providers.
3. Register a Web app and set the Firebase variables listed below.
4. Create Cloud Firestore in production mode.
5. Add each deployed hostname under **Authentication → Settings → Authorized
   domains**.
6. Deploy the committed Rules and indexes:

```bash
npx firebase-tools@15 login
npx firebase-tools@15 use --add
npx firebase-tools@15 deploy --only firestore:rules,firestore:indexes
```

Never launch with Firestore test-mode Rules. `firestore.rules` is the main data
authorisation layer, not optional application configuration.

## Environment variables

Copy `.env.example` to `.env.local` for development. Put production values in
the deployment platform; never commit `.env.local` or server secrets.

### Firebase browser configuration

These values identify a Firebase Web app. They are public by design; security
comes from Authentication, App Check when enabled, and Firestore Rules.

| Variable | Required for cloud mode | Purpose |
| --- | ---: | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Recommended | Auth redirect/popup domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firestore project and token audience |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | No at launch | Reserved Firebase config field |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | No at launch | Firebase app config field |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Recommended | Firebase Web app ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional | Firebase Analytics measurement ID |

Non-prefixed Firebase fallbacks exist for non-browser build environments, but a
browser deployment should use the documented `NEXT_PUBLIC_*` names.

### URL and email configuration

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Build/public | Absolute canonical origin, e.g. `https://flousy.app` |
| `APP_URL` | Server | Trusted base for invitation accept links; falls back to the canonical/platform URL |
| `RESEND_API_KEY` | Server secret | Enables invitation and contact delivery |
| `RESEND_FROM_EMAIL` | Server | SPF/DKIM-verified sender, e.g. `SmartJib <hello@flousy.app>` |
| `CONTACT_TO_EMAIL` | Server | Fixed recipient for public contact messages |

Production refuses Resend's `@resend.dev` sandbox sender. Vercel variables are
scoped independently to Production, Preview and Development, and a redeploy is
required after changes.

Readiness probes send no mail and reveal no secrets:

```bash
curl -fsS https://<deployment>/api/contact
curl -fsS https://<deployment>/api/household-invitations
```

### Optional analytics

Analytics remains off until a user explicitly grants consent. When a Firebase
measurement ID is configured, Firebase Analytics loads lazily after consent.
`NEXT_PUBLIC_ANALYTICS=plausible` or `ga` can select an additional pre-installed
provider bridge; this repository does not inject those third-party scripts for
you. All providers receive only centrally allowlisted parameters—never amounts,
balances, categories, names, notes, receipts, invitation query values or
arbitrary free text.

## Commands and validation

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server on `0.0.0.0:3000` |
| `npm run build` | Production Next.js build |
| `npm start` | Serve the production build on `0.0.0.0:3000` |
| `npm run lint` | ESLint over `src`/`tests` plus authoritative Firebase Rules syntax parsing, zero warnings allowed |
| `npm run typecheck` | Normal TypeScript check |
| `npm run typecheck:strict` | Strict TypeScript check |
| `npm test` | All non-emulator unit/regression suites |
| `npm run test:rules` | Firestore Rules suite; requires a running Firestore emulator |
| `npm run check` | Lint + normal/strict typecheck + unit tests |
| `npm audit --omit=dev` | Production dependency vulnerability gate |

Run the complete local release sequence as follows:

```bash
npm ci
npm audit --omit=dev
npm run check
npx firebase-tools@15 emulators:exec --only firestore \
  --project smartjib-rules-test "npm run test:rules"
npm run build
```

The test suites cover money invariants, complete finance journeys, conflict and
outbox behavior, entitlement expiry, Household RBAC, onboarding, month locking,
CSV/backup safety, mutation-time import entitlement/RBAC, contact acceptance/retry,
token verification, analytics sanitisation, i18n catalog parity, schema/Rules drift,
security headers, PWA behavior, SEO and shopping-course capture. `npm run lint`
also parses `firestore.rules` with Firebase's authoritative ANTLR grammar; behavioral
Rules authorization still requires the official Java-backed emulator suite.

## Data model

The canonical machine-readable contract is
[`firebase-blueprint.json`](firebase-blueprint.json). Tests compare it with
TypeScript interfaces, database paths and selected Rules bounds.

Key paths include:

```text
users/{uid}                         profile + entitlement projection
users/{uid}/months/{YYYY-MM}        revisioned personal month aggregate
users/{uid}/data/savings            global personal goals
users/{uid}/ledger/{mutationId}     immutable personal mutation audit
users/{uid}/products/{barcode}      private product catalog
users/{uid}/sessions/{sessionId}    completed shopping sessions

households/{householdId}            owner/config/entitlement projection
households/{householdId}/members/*  active membership and role
households/{householdId}/months/*   revisioned shared month aggregate
households/{householdId}/savings/*  shared goals
households/{householdId}/ledger/*   immutable shared mutation audit
households/{householdId}/invoices/* contributor invoice workflow

householdInvites/{inviteId}         expiring invitation grant
```

Modern persisted IDs use `crypto.randomUUID()` when available. Legacy records
remain readable through normalisers; production changes must preserve that
compatibility.

## Internationalisation

`messages/en.json`, `messages/fr.json` and `messages/ar.json` have identical key
shapes, checked by tests. Arabic uses RTL direction; language preference is
applied before first paint from browser storage and then synchronized with the
profile when signed in.

The app intentionally has **one URL per page** today. Language is a client
preference, not `/en`, `/fr` or `/ar` routing, so metadata declares only real
canonical URLs and does not publish broken locale alternates. Locale-prefixed
routing and server-rendered localized metadata are a post-launch SEO refactor.

## Privacy and security

- Personal data is private to its owner; Household data is visible only to
  active members according to Rules-enforced roles.
- No bank connection, bank credential collection or in-app payment-card form.
- Optional analytics is consent-gated and parameter-allowlisted.
- Contact content goes only to the configured support recipient through Resend.
- Barcode text may be sent to Open Food Facts only when a lookup is requested.
- CSV and JSON exports are available from Profile; deletion failures stay
  visible and retryable.
- Security headers include CSP, HSTS, `nosniff`, referrer/permissions policy,
  frame protection and popup-compatible COOP.
- Receipt attachments are resized, compressed and bounded before persistence.
- API responses and authenticated app shells use no-store/private cache policy;
  hashed static assets use immutable caching.

The running application serves its Privacy Policy at `/privacy`, Terms at
`/terms`, and Cookie Policy at `/cookies`. Legal copy must be reviewed
by the operating entity before launch; repository text is not a substitute for
jurisdiction-specific legal advice.

## Progressive Web App

The manifest, icons, install flow, service worker and offline fallback are under
`public/` and `src/components/pwa/`. The worker never caches Firebase/Auth,
cross-origin or non-GET traffic. Navigations are network-first; Firebase and the
finance outbox own data resilience.

PWA installation requires HTTPS (except localhost). iOS uses an explicit Add to
Home Screen guide because it does not expose `beforeinstallprompt`.

## SEO and public content

- Public per-page metadata, generated Open Graph image and canonical URLs.
- `SoftwareApplication`, `Organization`, `WebSite` and FAQ JSON-LD.
- Sitemap includes public routes and blog posts, excluding login/onboarding/app
  routes; robots applies matching private exclusions.
- `public/llms.txt` contains a factual feature/pricing summary.
- SEO tests keep currency, budgeting strategy, public FAQ and route facts aligned.

Set `NEXT_PUBLIC_SITE_URL` separately for production and previews. Do not create
hreflang entries until corresponding locale URLs actually exist.

## Deployment

Vercel is the primary supported target because this application includes Node
API routes as well as prerendered pages.

```bash
npm i -g vercel
vercel
```

At minimum, a production operator must:

1. configure Firebase and server email variables;
2. deploy Rules and indexes from the same release commit;
3. authorize the production and preview auth domains;
4. verify the Resend sender domain and contact recipient;
5. run readiness probes and authenticated smoke journeys;
6. enable monitoring, budgets/alerts and Firebase App Check deliberately;
7. confirm backup/restore and account-deletion behavior against production;
8. complete every blocking item in [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md).

The public pages are prerendered. Authenticated app HTML contains no user data,
is marked private/no-store, and hydrates data client-side from Firebase/local
cache. `src/proxy.ts` owns CSP and cache policy; `next.config.mjs` owns the other
security headers.

## Continuous integration

[`ci/github-actions-ci.yml`](ci/github-actions-ci.yml) defines the intended gate
on Node 24 and Java 21:

1. locked install;
2. production dependency audit;
3. ESLint, normal and strict TypeScript, and unit tests;
4. Firestore emulator Rules regressions;
5. production build;
6. Rules/index deployment on `main` when deployment credentials are present.

It is intentionally stored under `ci/` because the currently connected GitHub
App cannot write `.github/workflows/`. CI is **not active merely because this
file exists**. A repository administrator with workflow permission must move it
to `.github/workflows/ci.yml`, require the check, and configure:

- secret `FIREBASE_SERVICE_ACCOUNT`;
- repository variable `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.

See [`ci/README.md`](ci/README.md) and the production checklist. Do not merge a
release on the assumption that the inactive workflow has run.

## Known constraints and post-launch work

Launch intentionally does **not** pretend these provider-heavy capabilities are
implemented:

- live CMI/Stripe billing;
- bank aggregation/sync;
- receipt OCR;
- push notifications;
- Open Food Facts contribution and static Morocco catalog ingestion;
- per-category splitting of a shopping course;
- locale-prefixed SEO routes.

Current scale/operations constraints:

- A month is a bounded aggregate document (up to the Rules-defined limits), so a
  future transaction-subcollection migration is needed at larger scale.
- Contact/invitation/error-sink abuse counters use Upstash Redis when
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set (durable across
  instances) and fall back to per-instance in-memory counting otherwise;
  Arcjet shield/bot detection activates with `ARCJET_KEY`. Platform/WAF-level
  controls and alerts remain a deployment responsibility.
- Receipt images are bounded inline data rather than Firebase Storage objects.
- Firestore Rules cannot rate-limit document writes; App Check, quotas and cost
  alerts are deployment responsibilities.
- Demo/local mode is for evaluation, not a substitute for authenticated cloud
  backup.

The full implementation matrix is in [`MVP_TODO.md`](MVP_TODO.md); historical
findings and resolution evidence are in [`AUDIT_2026-08-31.md`](AUDIT_2026-08-31.md).

## Troubleshooting

### The app opens in Demo Mode

Firebase did not initialize. Verify at least
`NEXT_PUBLIC_FIREBASE_API_KEY` and `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, then
restart the dev server or redeploy (public variables are compiled into the
bundle).

### Firestore reads/writes are denied

Confirm that the signed-in account owns or belongs to the selected workspace,
that the period is open, and that current `firestore.rules` and indexes were
deployed. Browser logs include structured Firestore operation/path details.

### Google sign-in fails

Add the exact deployment hostname to Firebase Authorized domains. In-app
browsers may block popups; SmartJib falls back to redirect authentication.

### Contact/invitation email is unavailable

Run both readiness GETs. Configure `RESEND_API_KEY`, a verified non-sandbox
`RESEND_FROM_EMAIL`, `CONTACT_TO_EMAIL`, and trusted URL variables for the same
Vercel environment, then redeploy.

### Account deletion requests recent login

Firebase requires a recent credential for destructive authentication actions.
Sign out, sign back in and retry; SmartJib preserves the incomplete-state report.

---

<div align="center"><sub>Built with Next.js, Firebase and TypeScript.</sub></div>
