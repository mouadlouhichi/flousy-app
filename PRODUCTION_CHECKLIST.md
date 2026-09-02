# SmartJib Production Checklist

> **Release candidate date:** 2026-09-02
> **Scope:** first production launch with the core Free plan and a no-card Pro
> beta claim. Live CMI/Stripe billing is explicitly out of scope.
>
> This is an operator checklist, not a claim that external systems are already
> configured. Check an item only after collecting the evidence named beside it.
>
> **Provenance note:** this file was reconstructed from a draft written in a
> prior (now inaccessible) working session. That draft referenced work that was
> **never pushed** and is **not present in this branch** — those items are
> marked `[NOT IN THIS BUILD]` below and listed in §13 so they are recreated
> deliberately instead of being assumed to exist:
>
> - a `BILLING_LIVE` flag in `src/lib/payments.ts`
> - a 90-day trial entitlement (`source: launch_trial`, `status: trialing`,
>   end timestamp exactly 7,776,000,000 ms after start) — this branch instead
>   ships a one-time, non-expiring beta claim gated by `proTrialClaimedAt`
> - a working `/api/contact` endpoint (Resend) + `CONTACT_TO_EMAIL`; the
>   contact form in this build **fakes success client-side and sends nothing**
> - ESLint parsing `firestore.rules` with Firebase's ANTLR grammar
> - the draft's evidence counts (304 tests / 72 suites); this branch is at
>   292 tests / 70 suites

## Status and ownership

- `[REPO]` can be completed and evidenced from this repository.
- `[EXTERNAL]` requires access to Firebase, Vercel/hosting, Resend, DNS, GitHub or
  another production account.
- `[MANUAL]` requires a real browser/device or human review.
- **BLOCKER** means do not launch until complete.

Record the release identifiers before testing:

| Item | Value |
| --- | --- |
| Git commit SHA | `____________________________` |
| Pull request / approval | `____________________________` |
| Vercel production deployment | `____________________________` |
| Firebase project ID | `____________________________` |
| Production origin | `https://____________________` |
| Rules release timestamp | `____________________________` |
| Release owner | `____________________________` |
| Rollback owner | `____________________________` |

## 1. Repository release gates — BLOCKER

- [ ] `[REPO]` Working tree contains only reviewed release changes.
- [x] `[REPO]` Locale catalogs have identical key shapes (parity test green,
      2026-09-02).
- [ ] `[REPO]` No guessed paid price, simulated payment, card form, fake receipt,
      or automatic-renewal claim is exposed **to real signed-in accounts**.
      Current state: real accounts get the no-card beta claim only; the
      simulated Stripe checkout is confined to demo mode. Re-verify on the
      release SHA.
- [ ] `[REPO]` Free and Pro marketing copy matches `src/lib/pro-features.ts` and
      runtime gates.
- [ ] `[REPO]` Legal, FAQ, `public/llms.txt` and structured-data pricing statements
      all describe the same no-card beta claim (no invented prices or cycles).
- [x] `[REPO]` Schema/type/Rules drift tests pass against
      `firebase-blueprint.json` (2026-09-02).
- [ ] `[REPO]` Review dependency changes and licenses before the locked install.
- [ ] `[NOT IN THIS BUILD]` `BILLING_LIVE` flag — recreate per §13 or drop from
      scope explicitly.

Run from a clean checkout of the release SHA:

```bash
node --version                         # expected release baseline: Node 24.x
npm ci
npm audit --omit=dev
npm run lint
npm run typecheck
npx tsc --noEmit --strict
npm test
npx --yes firebase-tools@15 emulators:exec \
  --only firestore \
  --project smartjib-rules-test \
  "npm run test:rules"
NEXT_TELEMETRY_DISABLED=1 npm run build
```

`npm run lint` covers `src/` and `tests/` (including `jsx-a11y` at zero
warnings); it does **not** parse `firestore.rules`. Authorization behavior is
covered only by `npm run test:rules`, which requires Java 21 and the official
Firestore emulator. A local build can use empty Firebase values and run in demo
mode, but the release deployment must be rebuilt with the production public
Firebase configuration.

### Release evidence

| Gate | Result | Date / log or check URL |
| --- | --- | --- |
| `npm ci` | Local candidate pass; repeat on release SHA with Node 24 | 2026-09-02 (sandbox Node emitted the expected ZXing Node-24 engine warning; final baseline remains Node 24) |
| `npm audit --omit=dev` | Pass — 0 production vulnerabilities | 2026-09-02 local candidate |
| ESLint (zero warnings, incl. jsx-a11y) | Pass | 2026-09-02 local candidate |
| Normal TypeScript | Pass | 2026-09-02 local candidate |
| Strict TypeScript | Pass | 2026-09-02 local candidate |
| Unit/regression suites | Pass — 292 tests, 70 suites | 2026-09-02 local candidate |
| Firestore emulator Rules suite (12 tests) | **Pending / release blocked** — Java 21 and official emulator unavailable in the local sandbox | Assign to activated CI or release operator |
| Production build | Pass — 36 static pages generated | 2026-09-02 local candidate |
| PR checks | Pending | Save required-check URL after the workflow is activated |

If any gate cannot run, mark the release **blocked** — do not silently
reinterpret "not run" as "passed."

## 2. GitHub and CI — BLOCKER

- [ ] `[EXTERNAL]` Grant the connected GitHub App workflow-write permission, or
      have an authorized maintainer move `ci/github-actions-ci.yml` to
      `.github/workflows/ci.yml`. (Retested 2026-09-02: push still rejected
      without the permission — see `ci/README.md`.)
- [ ] `[EXTERNAL]` Configure repository secret `FIREBASE_SERVICE_ACCOUNT` with a
      least-privilege deployment service account.
- [ ] `[EXTERNAL]` Configure repository variable
      `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
- [ ] `[EXTERNAL]` Protect `main`: require review, the complete `check` job and a
      current branch before merge.
- [ ] `[EXTERNAL]` Confirm the workflow uses Node 24 and Java 21 and actually runs
      the dependency audit, unit gates, Rules emulator and production build.
- [ ] `[EXTERNAL]` Verify the post-merge Rules/index deployment step ran against
      the intended Firebase project, not a test project.
- [ ] `[EXTERNAL]` Save the successful workflow URL in the release evidence table.

The file under `ci/` is only a workflow **definition**. GitHub does not execute
it until it is under `.github/workflows/`.

## 3. Production Firebase — BLOCKER

### Project and Authentication

- [ ] `[EXTERNAL]` Use a dedicated production Firebase project; record its ID.
- [ ] `[EXTERNAL]` Enable Email/Password and Google providers.
- [ ] `[EXTERNAL]` Set a public support email and approved OAuth consent-screen
      branding.
- [ ] `[EXTERNAL]` Add the exact production hostname and every intended preview
      hostname to Firebase Authorized domains.
- [ ] `[EXTERNAL]` Review password policy, account enumeration protection and
      Authentication quotas.
- [ ] `[MANUAL]` Test sign-up, sign-in, sign-out, Google popup, Google redirect,
      password reset, verification email and recent-login recovery.

### Firestore

- [ ] `[EXTERNAL]` Create Firestore in the intended production region. Confirm the
      data-residency choice with the operating entity before data is stored.
- [ ] `[REPO]` Firestore emulator regressions pass with `firestore.rules` from the
      release SHA (blocked locally — no Java; run in CI/release machine).
- [ ] `[EXTERNAL]` Deploy Rules **and indexes** from that same SHA:

```bash
npx --yes firebase-tools@15 deploy \
  --only firestore:rules,firestore:indexes \
  --project "$PRODUCTION_FIREBASE_PROJECT_ID" \
  --non-interactive
```

- [ ] `[EXTERNAL]` Capture deployment output and inspect the active Rules in the
      Firebase console.
- [ ] `[MANUAL]` Verify a second signed-in account cannot read or write the first
      account's profile, month, savings, product or session paths.
- [ ] `[MANUAL]` Verify a non-member cannot read Household data, a viewer cannot
      write, a contributor cannot bypass invoice submission, and only the owner
      can close/reopen or delete the Household.
- [ ] `[MANUAL]` Verify an existing month cannot be overwritten with onboarding
      `bootstrap`, and existing goals cannot be overwritten with
      `savings-bootstrap`.
- [ ] `[MANUAL]` Verify edits to a closed month, including course posting and
      invoice approval, fail without changing local/cloud totals.
- [ ] `[EXTERNAL]` Configure Firestore usage budgets and anomaly/cost alerts.

### App Check

- [ ] `[EXTERNAL]` Register production web origins with Firebase App Check.
- [ ] `[EXTERNAL]` Start in monitoring mode; inspect legitimate web, PWA, preview
      and OAuth traffic before enforcement.
- [ ] `[MANUAL]` Confirm App Check does not break Auth, Firestore subscriptions,
      direct Open Food Facts fallback or server-side invitation verification.
- [ ] `[EXTERNAL]` Enforce App Check only after the monitoring window is clean and
      a rollback owner is available.

App Check setup cannot be completed by repository code alone and must not be
switched directly to enforcement without a monitoring phase.

## 4. Hosting and environment — BLOCKER

Use an environment matrix; do not assume Vercel Preview inherits Production:

| Variable | Development | Preview | Production |
| --- | ---: | ---: | ---: |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | [ ] | [ ] | [ ] |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | [ ] | [ ] | [ ] |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | [ ] | [ ] | [ ] |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | [ ] | [ ] | [ ] |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | [ ] | [ ] | [ ] |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | [ ] | [ ] | [ ] |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional) | [ ] | [ ] | [ ] |
| `NEXT_PUBLIC_SITE_URL` | [ ] | [ ] | [ ] |
| `APP_URL` | [ ] | [ ] | [ ] |
| `RESEND_API_KEY` | [ ] | [ ] | [ ] |
| `RESEND_FROM_EMAIL` | [ ] | [ ] | [ ] |
| `CONTACT_TO_EMAIL` `[NOT IN THIS BUILD]` | — | — | — |

- [ ] `[EXTERNAL]` Production `NEXT_PUBLIC_SITE_URL` is the exact HTTPS canonical
      origin with no path or trailing environment alias.
- [ ] `[EXTERNAL]` Production `APP_URL` resolves invitation links to the same
      trusted origin.
- [ ] `[EXTERNAL]` Public Firebase values belong to the recorded production
      project.
- [ ] `[EXTERNAL]` Server secrets are not exposed as `NEXT_PUBLIC_*`, build logs,
      source maps or client responses.
- [ ] `[EXTERNAL]` Rebuild/redeploy after setting public variables; they are
      compiled into the client bundle.
- [ ] `[EXTERNAL]` Pin the production deployment to the recorded release SHA.
- [ ] `[MANUAL]` Inspect `/`, `/login`, `/onboarding`, `/dashboard`, all legal
      pages, blog posts and the deployed APIs on the deployed origin.
- [ ] `[MANUAL]` Confirm private routes and API responses return no-store/private
      cache policy; confirm the production CSP and security headers are present.
      Note: CSP still allows `'unsafe-inline'` scripts (open audit item S4).
- [ ] `[MANUAL]` Confirm no private account data appears in served HTML, CDN cache
      inspection or another browser session.

## 5. Domain, DNS and email — BLOCKER for public contact/invitations

- [ ] `[EXTERNAL]` Point the production domain to the intended hosting project.
- [ ] `[EXTERNAL]` Confirm TLS issuance, HTTPS redirect and certificate renewal.
- [ ] `[EXTERNAL]` Verify the sending domain in Resend.
- [ ] `[EXTERNAL]` Publish and validate the exact DKIM records Resend provides.
- [ ] `[EXTERNAL]` Publish an SPF policy that includes every real sender without
      creating multiple conflicting SPF records.
- [ ] `[EXTERNAL]` Publish DMARC first in monitored mode (`p=none`) with an owned
      report mailbox; move to quarantine/reject only after reports are clean.
- [ ] `[EXTERNAL]` Set `RESEND_FROM_EMAIL` to the verified domain. Production must
      not contain `@resend.dev` (the invitation API refuses the sandbox sender).
- [ ] `[MANUAL]` Test invitation delivery to at least Gmail, Outlook and one
      custom-domain mailbox; inspect spam placement, From/Reply-To, encoding and
      links.
- [ ] `[MANUAL]` Verify an invitation code remains visible/copyable when Resend is
      unavailable.
- [ ] **BLOCKER `[REPO]`** The contact form (`contact-form.tsx`) currently shows a
      success state without sending anything. Before launch either implement
      `/api/contact` (Resend, rate-limited, idempotent) or replace the form with
      an honest `mailto:`/support-address block. `[NOT IN THIS BUILD]`

Invitation readiness check (sends nothing and reveals no secret):

```bash
curl -i https://<production>/api/household-invitations
# Expect HTTP 200 and: {"emailConfigured":true,"sandboxSender":false,"code":"ready",...}
```

In-memory API counters are per server instance. Configure hosting/WAF-level
rate limits, Resend quotas and alerts for distributed abuse.

## 6. Billing-disabled launch — BLOCKER

Current model in this branch: Pro is a **one-time, no-card beta claim**. The
only `plan` transition `firestore.rules` permits is `free → pro` stamped with a
non-repeatable `proTrialClaimedAt`. There is no expiry. The simulated Stripe
checkout renders only in demo mode.

- [ ] `[MANUAL]` Search every public/app surface in English, French and Arabic:
      no paid amount, recurring offer, billing cycle, checkout simulation or card
      input is shown to a real signed-in account.
- [ ] `[MANUAL]` Network inspection shows no request to Stripe, CMI or another
      payment processor.
- [ ] `[EXTERNAL]` No Stripe/CMI production secret is configured for this release.
- [ ] `[MANUAL]` A new disposable account can claim Pro once without a card.
- [ ] `[MANUAL]` A second claim and any attempt to re-write `proTrialClaimedAt`
      are rejected by Firestore Rules.
- [ ] `[MANUAL]` Household access follows the owner's entitlement rather than a
      stale local flag.
- [ ] `[NOT IN THIS BUILD]` 90-day trial semantics (`launch_trial` source,
      `trialing` status, exact 7,776,000,000 ms end timestamp, expiry-driven
      downgrade with data still exportable). If the launch requires a bounded
      trial, recreate per §13 **before** launch; otherwise document the
      unbounded beta claim in legal/FAQ copy.

Use disposable test accounts. Claiming a production beta Pro is intentionally
one-time and should not be "reset" manually to make a test pass.

## 7. Privacy, legal and consent — BLOCKER

- [ ] `[EXTERNAL]` The operating entity and qualified local counsel review the
      current Privacy Policy, Terms and Cookie Policy.
- [ ] `[EXTERNAL]` Confirm entity name, legal contact, governing law, minimum age,
      retention periods and data-subject request process for the actual launch
      jurisdiction(s).
- [ ] `[EXTERNAL]` Execute/review processor terms and DPAs for Firebase/Google,
      Vercel/host, Resend, optional analytics and Open Food Facts where applicable.
- [ ] `[EXTERNAL]` Confirm Firebase/hosting regions and cross-border-transfer
      disclosures.
- [ ] `[MANUAL]` Consent defaults to no analytics before any choice.
- [ ] `[MANUAL]` Denial persists and sends no analytics request/event.
- [ ] `[MANUAL]` Grant and withdrawal work from Profile.
- [ ] `[MANUAL]` Inspect analytics payloads: no amount, balance, category, person,
      name, note, receipt, contact body, invitation code/query or arbitrary text.
      (Open audit item: privacy copy ↔ payload reconciliation not yet done.)
- [ ] `[MANUAL]` Verify CSV export, complete JSON backup/restore, data deletion and
      account deletion from **Profile**, including partial-failure messaging.
- [ ] `[EXTERNAL]` Define support handling for access/deletion requests that cannot
      be completed in-app.

Do not advertise deletion as erasing provider security/delivery logs outside
SmartJib's control.

## 8. Monitoring, security operations and incident readiness — BLOCKER

- [ ] `[EXTERNAL]` Enable Vercel/host function and deployment logs with an agreed
      retention period and access controls.
- [ ] `[EXTERNAL]` Enable Firebase Auth/Firestore monitoring, quota alerts and
      billing-budget alerts.
- [ ] `[EXTERNAL]` Configure uptime checks for `/`, `/login` and
      `/api/household-invitations` (GET only; do not generate mail).
- [ ] `[EXTERNAL]` Alert on elevated 5xx/429 rates, Auth failures, Firestore denied
      writes, Resend delivery failures and cost anomalies.
- [ ] `[EXTERNAL]` Choose an error-monitoring provider or document the deliberate
      host/Firebase-log-only decision; apply consent and redaction rules before
      adding any SDK. (No error-monitoring SDK is present in this build.)
- [ ] `[EXTERNAL]` Create an incident channel, primary/backup owner and severity
      definitions.
- [ ] `[EXTERNAL]` Document credential rotation for Firebase deploy credentials,
      Resend and GitHub.
- [ ] `[EXTERNAL]` Test revoking/rotating a non-production Resend key.
- [ ] `[EXTERNAL]` Review production access under least privilege and enable MFA
      for GitHub, Firebase/Google, Vercel, DNS and Resend administrators.
- [ ] `[MANUAL]` Check logs from a smoke test and confirm they do not contain
      financial payloads, bearer tokens or invitation codes.

## 9. Manual release journeys — BLOCKER

Run on production configuration before DNS cutover (preview) and again after
cutover. Test desktop Chrome/Firefox/Safari plus real iOS Safari and Android
Chrome where available.

### Authentication and onboarding

- [ ] New email account → verification → five-step personal onboarding.
- [ ] Onboarding starts with **empty** income and **no** pre-seeded bills; the
      Rent/Electricity chips only prefill the form (2026-09-02 change).
- [ ] French decimal-comma and Arabic-digit amounts parse correctly in
      onboarding, course prices and money-places editing (2026-09-02 change).
- [ ] Reload/back/re-entry does not overwrite an existing month or savings data.
- [ ] Existing onboarded account skips onboarding safely.
- [ ] Google popup and blocked-popup redirect fallback.
- [ ] Demo mode is clearly local-only and does not contaminate a signed-in account.

### Personal finance

- [ ] Add/edit/delete variable expense and fixed charge; verify place balances.
- [ ] Move money and adjust a balance; verify conservation and audit behavior.
- [ ] Create/fund/withdraw/edit/delete a saving goal.
- [ ] Add/edit/settle/delete debt and credit, including installment payments.
- [ ] Create a future month; verify recurring income/fixed items materialise once.
- [ ] Simulate offline write/reload/reconnect; verify pending state and no duplicate.
- [ ] Generate a conflict from two sessions; verify retry/discard is truthful.
- [ ] Close a month, attempt every write path, then reopen as owner.

### Pro and Household

- [ ] Claim the one no-card beta Pro and check all Pro navigation/features.
- [ ] Free user is blocked from gated features per `pro-features.ts`.
- [ ] Data export/JSON backup remains available to a Free user.
- [ ] Create Household; invite editor/viewer/contributor; accept each role.
- [ ] Verify owner/editor/viewer/contributor read/write matrix on separate accounts.
- [ ] Contributor submits invoice; owner approves exactly once into an open month.
- [ ] Household recurring income/fixed items roll over exactly once.
- [ ] Owner closes/reopens Household month; non-owner cannot do so.
- [ ] Member leave, deactivate/restore/remove and owner delete paths.

### Shopping course

- [ ] Manual product flow works with no camera/network lookup.
- [ ] Camera permission grant/deny/retry on iOS and Android.
- [ ] Native barcode and ZXing fallback where supported.
- [ ] Catalog → Open Food Facts → manual fallback, including timeout/failure.
- [ ] Price-embedded (prefix-2) scale barcodes prefill the price and skip lookup.
- [ ] Quantity/price edit, bill text/CSV/share and history.
- [ ] Posting is idempotent and refuses a closed target month.

### Locales, accessibility, PWA and public site

- [ ] English, French and Arabic catalog rendering; Arabic RTL before first paint.
- [ ] Currency/date/number formatting in all three locales.
- [ ] Keyboard-only navigation, focus order, dialog focus trap, topmost-only
      Escape, and visible focus (2026-09-02 changes).
- [ ] Skip-to-content link appears on first Tab and moves focus into `<main>`.
- [ ] Screen-reader labels and error/status announcements on critical flows.
- [ ] 200% zoom/reflow (pinch zoom is no longer disabled) and reduced-motion
      behavior.
- [ ] PWA install, standalone launch, update and offline fallback on real devices.
- [ ] Contact surface: see §5 blocker — do not ship the fake-success form.
- [ ] Canonical, sitemap, robots, Open Graph and JSON-LD point to production.
- [ ] No `/en`, `/fr` or `/ar` alternate URL is advertised or expected at launch.
- [ ] Run Lighthouse/PageSpeed against production and record mobile/desktop output.

Browser/Lighthouse checks are manual gates when the release environment has no
browser binary; they are not replaced by unit tests.

## 10. Backup, recovery and rollback — BLOCKER

- [ ] `[EXTERNAL]` Enable and test an appropriate Firestore backup/export schedule
      for the production plan and region.
- [ ] `[EXTERNAL]` Restrict backup access and document retention/deletion.
- [ ] `[MANUAL]` Export a disposable workspace JSON backup, mutate it, restore it
      and compare months/goals/products/sessions as applicable.
- [ ] `[EXTERNAL]` Record recovery-time and recovery-point objectives.
- [ ] `[EXTERNAL]` Identify the last known-good Vercel deployment and release SHA.
- [ ] `[EXTERNAL]` Rehearse promoting/rolling back a non-production deployment.
- [ ] `[EXTERNAL]` Keep the previous Firestore Rules/index files and document a
      controlled redeploy command.
- [ ] `[EXTERNAL]` Confirm rollback will not strand documents written by the new
      client. There are no destructive migrations in this release; legacy
      normalisation must remain intact.

Suggested rollback sequence:

1. stop the rollout or promote the last known-good hosting deployment;
2. if Rules are the fault, deploy reviewed Rules from the matching known-good SHA;
3. verify Auth, personal reads and Household reads with disposable accounts;
4. preserve logs/evidence and announce incident status;
5. do not rewrite/delete user data merely to make an older client accept it.

## 11. Launch and post-launch watch

- [ ] All BLOCKER sections have named evidence and owner sign-off.
- [ ] Product, engineering, operations and legal owners record go/no-go below.
- [ ] Deployment and Rules SHA match.
- [ ] DNS cutover/production promotion has a rollback owner online.
- [ ] Run the short smoke set immediately after promotion: home, login, existing
      account load, one reversible finance edit, the invitation readiness GET
      and logout.
- [ ] Watch errors, denied writes, email delivery, Auth, latency and spend closely
      for at least the first 24 hours.
- [ ] Review beta-Pro claims without inspecting users' financial content.
- [ ] Publish a support path and incident/status communication channel.

### Go/no-go sign-off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Engineering | | Go / No-go | |
| Product | | Go / No-go | |
| Operations/Security | | Go / No-go | |
| Legal/Privacy | | Go / No-go | |

## 12. Explicitly separate post-launch/external work

These are not fake "implemented" launch features:

- **Live payments:** select Moroccan CMI or Stripe only after commercial/legal
  onboarding. Implement provider-hosted checkout and verified idempotent
  webhooks against the existing adapter seam; never collect PAN/CVC in SmartJib.
- **Bank aggregation:** provider, compliance, consent and threat-model project.
- **Receipt OCR:** provider/data-processing and accuracy project; bounded receipt
  attachment already works without OCR claims.
- **Push notifications:** separate permission, delivery, privacy and unsubscribe
  design.
- **Locale URL routing:** implement real localized URLs and server metadata before
  adding hreflang.
- **Social accounts:** `[EXTERNAL]` reserve/verify official SmartJib handles,
  enable MFA, define owners and publish only links to accounts actually operated.
- **Search/merchant presence:** `[EXTERNAL]` submit sitemap/Search Console and
  verify public profiles after DNS stabilizes.

Any item promoted into launch scope must receive an owner, acceptance tests,
privacy/security review and rollback plan before it becomes a blocker.

## 13. Work referenced by the prior draft that must be recreated

The prior session's branch (`arena/01a05eeb-flousy-app`) was never pushed past
`7e00d42`, so the following exist only as intentions. Recreate them on this
branch (with tests) or explicitly drop them from launch scope:

1. **`/api/contact`** — Resend-backed contact endpoint with validation,
   rate-limiting, idempotent request IDs and a readiness GET; wire
   `contact-form.tsx` to it and remove the fake success state. **BLOCKER** if
   the contact page ships.
2. **`BILLING_LIVE` kill-switch** in `src/lib/payments.ts` asserting no billing
   surface renders while `false`.
3. **Bounded 90-day trial** (if desired over the current unbounded beta claim):
   `proTrialClaimedAt` + `proTrialEndsAt` (start + 7,776,000,000 ms), rules
   rejecting timestamp extension, expiry-aware entitlement in
   `pro-features.ts`/household access, downgrade path that preserves records
   and exports.
4. **Rules-syntax lint** — parse `firestore.rules` during `npm run lint` so a
   syntax error cannot reach the deploy step.
5. The ~12 additional tests covering the above (draft evidence cited 304 tests;
   this branch has 292).
