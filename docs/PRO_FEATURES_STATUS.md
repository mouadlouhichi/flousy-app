# Pro features — implementation status

PWA-only MVP. Every feature below is Pro-gated unless marked **Free**, localized
in EN/FR/AR, and lives behind `isProFeatureUnlocked()` (household members inherit
the owner's plan). Billing (CMI/Stripe) is intentionally **not** implemented:
`BILLING_LIVE = false`, the 90-day no-card trial is the only entitlement path.

Legend: ✅ done · ⚙️ done, needs production config · ⚠️ platform-limited · ⏳ not started

## Insights & planning

| Feature | Status | Where | Notes |
|---|---|---|---|
| Safe-to-spend + month-end forecast | ✅ | Overview → `safe-to-spend-card.tsx`, `insights.ts` | Daily allowance from remaining budget, upcoming fixed bills and days left |
| Net worth view | ✅ | Overview → `net-worth-card.tsx` | Cash places + savings + owed to me − debts |
| Unlimited history | ✅ | Month switcher / Trends | Free = current + 2 previous months (`isWithinFreeHistory`) |
| Debt payoff planner | ✅ | Debts → `debt-payoff-planner.tsx` | Snowball / avalanche, payoff date; budget & method saved on profile |
| Savings goal projections | ✅ | Savings → `goal-projection.tsx` | Pace, ETA, optional target date, required/month |
| Recurring payments calendar | ✅ | `upcoming-payments-calendar.tsx` | From fixed-bill schedule |
| Custom reports (place / tag / member) | ✅ | Trends → `custom-report-card.tsx`, `buildCustomReport()` | 1–12 month range, one AND filter, deltas vs previous window |
| Unlimited categories | ✅ | Category add | Free cap `FREE_CATEGORY_LIMIT = 10` |
| Merchant → category auto-suggest | ✅ | Expense sheet | From the month's history (`suggestCategory`) |

## Reminders & security

| Feature | Status | Where | Notes |
|---|---|---|---|
| Local bill & goal reminders | ✅ | `reminder-runner.tsx`, `reminders.ts` | While app is open / installed; deduped by tag |
| Web Push reminders | ⚙️ | `/api/push`, `/api/reminders/dispatch`, `vercel.json` cron 07:00 UTC | Needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `CRON_SECRET`. iOS only when installed to home screen |
| E-mail digest | ⚙️ | same dispatcher | Needs `RESEND_API_KEY` |
| App icon badge | ⚠️ | `reminder-runner.tsx` | `navigator.setAppBadge` — Chromium / installed PWA only |
| PIN app lock | ✅ | Profile → Security, `app-lock.ts`, `app-lock-gate.tsx` | |
| Biometric unlock (WebAuthn) | ⚠️ | Profile → Security | Platform authenticator only; falls back to PIN |

## Capture & search

| Feature | Status | Where | Notes |
|---|---|---|---|
| Tags on expenses | ✅ | Expense sheet | `VariableExpense.tags` |
| Global search (12 months) | ✅ | `/dashboard/search`, header button | Name / category / note / `#tag` |
| Receipt OCR | ✅ | Expense sheet → `receipt-ocr.ts` | Client-side tesseract.js, self-hosted worker/WASM (`scripts/copy-tesseract.mjs`, CSP `wasm-unsafe-eval`). Language models (~10 MB first run) from tessdata CDN |
| Barcode → expense name | ✅ | Expense sheet → `expense-barcode-scanner.tsx` | Reuses courses scanner hook + Open Food Facts proxy |
| Manifest shortcuts | ✅ | `public/manifest*.json` | Add expense / Bills / Savings |
| Android share target | ⚠️ | `variable-screen.tsx` | Prefills name + amount; Chromium/Android only |
| Background Sync outbox flush | ⚠️ | `dashboard-provider.tsx`, `sw.js` | Chromium only; falls back to `online` event |

## Data, workspaces & money

| Feature | Status | Where | Notes |
|---|---|---|---|
| PDF monthly report | ✅ | Profile → Data, `report.ts` | Print-CSS HTML → browser "Save as PDF"; RTL-aware; RBAC-filtered sections |
| Google Drive backup / restore | ⚙️ | Profile → Data, `drive-backup.ts` | `appDataFolder`, keeps last 5. Hidden until `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` is set |
| Currency converter (**Free**) | ✅ | Profile → Preferences, `/api/fx` | ECB rates via Frankfurter, 12 h cache, allow-listed codes |
| Household sharing | ✅ (pre-existing) | Profile → Household | |
| Multiple workspaces (business / auto-entrepreneur) | ✅ | Profile → Workspace | Household docs carry `kind: 'household' \| 'business'`; up to 3 business workspaces; roster/invites/invoices hidden for business |
| Shared household saving goals | ✅ | Savings (household) | Deposits attributed to the acting member; per-goal "Who contributed" split |

## Plumbing

| Item | Status |
|---|---|
| Firestore rules for new profile fields (bounded shapes, ≤10 push subscriptions) and workspace `kind` | ✅ |
| Emulator rules tests (`tests/firestore-rules.emulator.ts`) for the above | ✅ (runs in CI `check` job; needs Java locally) |
| `firebase-blueprint.json` synced (`PushSubscriptionRecord`, `SavingsActivityEntry.actor*`, `Household.kind`) | ✅ |
| CSP: `wasm-unsafe-eval`, GIS (`accounts.google.com`), tessdata | ✅ |
| `.env.example` documents every new variable | ✅ |
| `uuid` transitive advisory (GHSA-w5hq-g745-h8pq) → `overrides.uuid ^11.1.1` | ✅ |
| Unit tests: `tests/pro-insights.test.ts` (OCR parsing, suggestions, search, report, custom reports, contributions) | ✅ |

## Not in scope

- CMI / Stripe checkout (user decision — MVP ships with the trial only).
- Native-only features (SMS parsing, home-screen widgets, store billing).

## Production checklist

1. Set VAPID keys, `FIREBASE_SERVICE_ACCOUNT_JSON`, `CRON_SECRET`; verify the Vercel cron hits `/api/reminders/dispatch`.
2. Optional: `RESEND_API_KEY` (e-mail digest), `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` (Drive; add the site origin to the OAuth client).
3. Deploy `firestore.rules` (happens automatically on merge to `main`).
4. Smoke-test on a low-end Android: OCR first run, camera barcode scan, Drive consent popup, push permission prompt.
