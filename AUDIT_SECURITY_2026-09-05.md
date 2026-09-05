# Security Audit — SmartJib (flousy-app)

**Audit date:** 2026-09-05 · **Auditor role:** Senior mobile application security auditor / RASP specialist
**Target:** `mouadlouhichi/flousy-app` @ commit `03f4ec2` (branch `arena/01a071ad-flousy-app`)
**Classification:** Confidential — owner and advisors only

---

## 0. Platform determination (read first)

The request was scoped as an **iOS/Android/React Native/Flutter** audit. There is **no mobile binary in this repository**. Static and dynamic inspection shows:

| Evidence | Conclusion |
|---|---|
| `package.json` — `next@16.3.4`, `react@19.2.7`, Firebase JS SDK `12.16.0`, no `react-native` / `flutter` / `capacitor` / Xcode / Gradle files | **Next.js 16 App Router web app (installable PWA)** |
| Backend = Firebase Auth + Firestore + 4 Next.js API routes on Vercel; emails via Resend | Client-server web architecture, no custom SQL database |
| `public/manifest.json`, `public/sw.js`, `mobile-first` UI (from `metadata.json`) | PWA installable on Android/iOS home screens — runs in the browser sandbox, not a native binary |

Every category from the brief was therefore **mapped to its web-platform equivalent** (section 3.4 covers the mapping explicitly). Native-only controls (jailbreak/root detection, Frida anti-hooking, overlay attack defence, binary obfuscation, certificate pinning) are marked **N/A for this artifact** with a forward plan in §8 for when a native shell (Capacitor/RN/Flutter) is actually shipped. The 20-concept Backend Production Readiness checklist applies directly and is scored in §5.

**What was executed for this audit**

| Method | Detail | Result |
|---|---|---|
| Full static review | All 4 API routes, `src/proxy.ts`, `next.config.mjs`, auth stack (`auth-context.tsx`, `firebase-id-token.ts`, `auth-errors.ts`), storage layer (`db.ts`, `store.ts` caches), service worker, telemetry, demo mode, export/import, Firestore rules structure (~1,400 lines) | §4 findings |
| Secret scanning | TruffleHog-style pattern grep (API keys `AIza…`, `sk_`, `re_`, `ghp_`, AWS `AKIA`, private-key blocks, `.env` files incl. git history) | **Clean** — no secrets in tree or history |
| Dependency audit | `npm audit` against `package-lock.json` (656 deps) + version cross-check vs. latest releases and 2026 Next.js advisories | **0 advisories**; `next 16.3.4` includes the Aug-2026 critical fixes (16.3.3) and July-2026 proxy-bypass fix (16.2.11) |
| Test execution | `npm ci` + full unit suite | **489/489 pass** (104 suites), incl. `security-headers.test.ts`, `firebase-id-token.test.ts`, `rate-limit.test.ts` |
| CI/CD verification | `gh run list/view` on the GitHub repo | ⚠️ **`main` is red** — see finding **H-1** |
| Rules review | `firestore.rules` (default-deny, entitlement ledger, totality baseline) + emulator suite exists in CI (`check` job ✓ on main) | §4.3 |

*Not performed:* DAST against the live production host (no production URL/credentials available from this sandbox), manual pentest, Firestore emulator run locally (Java unavailable; CI's `check` job covers it and passed on `main`).

---

## 1. Executive summary

**Security posture score: 78 / 100 — GOOD, production-viable after the 5 priority fixes below.**

This is one of the more security-mature codebases an auditor sees at pre-launch: a default-deny Firestore ruleset with an emulator regression suite in CI, cryptographic (not trust-based) caller identity on the mail endpoints, no secrets anywhere in the tree, CSV formula-injection guards, consent-gated analytics, working GDPR export/erasure, honest error degradation, and 489 passing tests that pin the security headers. Zero exploitable findings in the classic OWASP Top-10 classes were identified: no injection, no BOLA/IDOR path found, no secrets leakage, no known-vulnerable dependencies, no XSS sink with user-controlled HTML.

The residual risk is concentrated in **operational configuration that is still un-wired**, not in code:

1. The pipeline that keeps **deployed server-side authorization in sync with the audited rules** is not configured (CI red on `main`).
2. The **anti-fraud layer is opt-in and currently inert** (Arcjet key unset, Upstash unset, App Check not integrated) — the code supports all three; the environments don't have the keys yet.
3. **No MFA** for email+password accounts on an app that holds a household's finances.
4. Device-local caching of financial data in `localStorage` (plaintext) — acceptable for a PWA, mitigated by a sign-out wipe, but worth tightening.
5. Supply-chain hygiene: no Dependabot, GitHub Actions pinned by mutable tag.

### Severity counts

| Severity | Count | IDs |
|---|---:|---|
| 🔴 Critical | **0** | — |
| 🟠 High | **3** | H-1, H-2, H-3 |
| 🟡 Medium | **6** | M-1 … M-6 |
| 🔵 Low | **6** | L-1 … L-6 |
| ⚪ Informational | 5 | I-1 … I-5 |
| ⚫ N/A (platform) | 5 | NA-1 … NA-5 |

### Top 5 priority fixes (ordered)

| # | Fix | Effort | Type |
|---|---|---|---|
| **1** | **Wire the production rules deploy**: add the `FIREBASE_SERVICE_ACCOUNT` repo secret + `NEXT_PUBLIC_FIREBASE_PROJECT_ID` variable so `deploy-rules` runs and `main` goes green. Until then, the rules running in production are whatever was last deployed by hand — the client's write contract and server authorization can drift (their own CI guard warns every budget write 403s in that state). | 15 min | Config only |
| **2** | **Turn on the already-built anti-abuse stack**: set `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (durable rate limits across serverless instances) and `ARCJET_KEY` (shield + bot detection) in Vercel. Both are coded and tested; they are inert without env vars. | 30 min | Config only |
| **3** | **Integrate + enforce Firebase App Check** (reCAPTCHA v3 web): stops scripted clients from driving Firestore/Auth/API directly with the public web config. Start in monitoring mode per the repo's own checklist (§3 of `PRODUCTION_CHECKLIST.md`), enforce after a clean window. | 0.5 day | Snippet in appendix A.1 |
| **4** | **Enable MFA (TOTP) for email+password accounts** + configure the Firebase password policy and API-key HTTP-referrer restrictions in the console (no code for enforcement; a small enrollment UI is in appendix A.3). | 0.5–1 day | Console + small code |
| **5** | **Supply-chain hygiene**: add `dependabot.yml` (content in appendix A.4) and SHA-pin the four action refs in `ci.yml`. | 30 min | Config only |

---

## 2. Dashboard overview

### 2.1 Category scorecard (mapped to the audit brief)

| # | Requested category | Web-equivalent scope audited | Score | Key gap |
|---:|---|---|:---:|---|
| 1 | Anti-fraud & bot protection | Rate limiting, bot detection, honeypot, token abuse, trial abuse, invitation abuse, account takeover | **65** | Arcjet/Upstash inert by default (M-1), no App Check (H-2), no MFA (H-3) |
| 2 | Anti-reverse engineering | Secrets in client bundle, debug flags, source maps, CSP, client-side logic exposure | **82** | Client is JS by nature; secrets posture is clean; CSP inline-script tradeoff (M-4) |
| 3 | API security | All 4 endpoints: authn, authz (BOLA), injection, rate limits, validation, HTTPS, "pinning" (HSTS) | **90** | Minor: env-string disclosure (L-2), per-instance dedupe (L-1) |
| 4 | Runtime protection (RASP) | Clickjacking, XSS, tab-nabbing, cache/XS-leak defence, service-worker integrity | **85** | `unsafe-inline` script CSP (M-4, accepted+compensated) |
| 5 | Data privacy & compliance | GDPR surface (consent, export, erasure, minimization, logging), local storage at rest | **80** | `localStorage` finance cache (M-2); processor DPAs are external tasks |
| 6 | Third-party SDK risk | 30 runtime deps, 15 dev deps — Firebase, ZXing, Resend, Arcjet; data flows of each | **90** | All minimal and consent-gated; 0 advisories |
| 7 | Binary & supply chain | Lockfile, npm audit gate in CI, action pinning, update automation, rules-deploy pipeline | **70** | No Dependabot (M-6), tag-pinned actions (M-6), rules deploy unconfigured (H-1) |

**Weighted overall: 78 / 100** (risk tiers: ≥85 hardened · 70–85 hardening tasks outstanding · <70 not release-ready)

### 2.2 Findings heatmap

```
Category              Crit  High  Med  Low  Info   Score
Anti-fraud / bot       0     2     1    1     0   ▓▓▓▓▓▓▓░░░ 65
Anti-reverse eng.      0     0     1    0     2   ▓▓▓▓▓▓▓▓░░ 82
API security           0     0     0    2     1   ▓▓▓▓▓▓▓▓▓░ 90
Runtime (RASP-equiv.)  0     0     1    0     1   ▓▓▓▓▓▓▓▓▓░ 85
Privacy / compliance   0     0     1    1     1   ▓▓▓▓▓▓▓▓░░ 80
Third-party SDKs       0     0     0    0     0   ▓▓▓▓▓▓▓▓▓░ 90
Binary / supply chain  0     1     1    1     0   ▓▓▓▓▓▓▓░░░ 70
```

### 2.3 Verified controls (what is done right — keep these)

| Control | Location | Evidence |
|---|---|---|
| RS256-only Firebase ID-token verification, `alg` header ignored (classic JWT `none`/HS256 bypass refused), `kid`+`iss`+`aud` pinned to project, ±60 s skew, clamped cert cache | `src/lib/firebase-id-token.ts:117–150+` | `tests/firebase-id-token.test.ts` ✓ |
| BOLA-proof mail endpoint: invite document is read **with the caller's own credentials** so Firestore rules decide visibility (`invitedBy == auth.uid` / ownership); body supplies an ID, never the recipient | `src/app/api/household-invitations/route.ts:99–125` | Code review |
| All 4 API routes rate-limited; invites additionally capped per-verified-user (8/10 min), contact per-IP (5/10 min), client-errors 10/min, barcode 60/min shared-limiter | `*/route.ts` + `src/lib/server/rate-limit.ts` | `tests/rate-limit.test.ts` ✓ |
| Honeypot field on the public contact form (bots get a fake success) | `src/app/api/contact/route.ts:110–114` | Code review |
| Host-header trust eliminated for the invitation link that grants household access (env/platform URLs only) | `src/app/api/household-invitations/route.ts:151–178` | Code review |
| HTML-escaped email bodies in both mail routes; Reply-To (never From) for submitter address | `contact/route.ts:36–41,186`; `household-invitations/route.ts:37–43` | Code review |
| CSV formula-injection guard (`=+-@` prefixed cells neutralized) + RBAC-filtered export sections | `src/lib/export.ts:3–16` | `tests/export.test.ts` ✓ |
| Default-deny ruleset tail: `match /{document=**} { allow read, write: if false; }`; money values type- and range-bounded; month IDs regex-validated; one-time launch-trial claim bound to server clock (±5 min) and exact 90-day projection | `firestore.rules:1408–1411`, `:25`, `:31`, `:51–68` | Emulator suite in CI ✓ |
| Rules deployment gated to `main` **and fails loudly when unconfigured** (a silent skip once left prod rules behind the client contract) | `.github/workflows/ci.yml:196–208` | GH run 33967909724 |
| Strict headers: HSTS preload 2y, nosniff, referrer-policy, Permissions-Policy (camera self only), COOP, CORP same-origin, `frame-ancestors 'none'` fail-closed, `script-src-attr 'none'`, `object-src 'none'`, `base-uri`, `form-action` | `next.config.mjs`, `src/proxy.ts:57–127` | `tests/security-headers.test.ts` ✓ |
| Service worker never caches Firestore/Auth/API traffic; non-GET never intercepted; navigations network-first | `public/sw.js:73–100` | `tests/pwa.test.ts` ✓ |
| Analytics opt-in only, Firebase Analytics chunk not loaded until consent; error beacon sanitized + consent-gated, size-capped, forwarded to sinks only when env vars exist | `src/lib/analytics.ts:23–49`, `src/components/observability-reporter.tsx` | `tests/analytics.test.ts` ✓ |
| Account deletion: recent-login re-auth **first**, verified data wipe, then account delete; local caches wiped on sign-out | `src/lib/auth-context.tsx:337–339, 375–381` | `tests/security-headers.test.ts` (erasure contract) ✓ |
| Sign-up password floor 10 chars (legacy accounts grandfathered at 6 with documented rationale); unified `invalid-credential` message on login | `src/lib/validation.ts:95–115`, `src/lib/auth-errors.ts:42–47` | `tests/validation.test.ts` ✓ |
| No secrets in repo or git history; `.env*` ignored; Firebase web config correctly treated as public identity, all server creds env-only | `.gitignore`, secret scan | This audit |
| Receipt images resized client-side to a 100 KB field budget (also bounds Firestore doc size abuse) | `src/lib/receipt-image.ts:20–27` | Code review |
| Next.js `16.3.4` — includes fixes for Aug-2026 criticals (GHSA AVIF/Windows, fixed 16.3.3) and Jul-2026 CVE-2026-64642 proxy bypass (fixed 16.2.11) | `package-lock.json` | This audit |

---

## 3. Findings detail (by requested coverage area)

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · ⚪ Informational

### 3.1 Anti-fraud & bot protection

**🟠 H-1 — Server-side authorization (deployed rules) can drift from the audited rules; release gate is red on `main`**
- **Where:** `.github/workflows/ci.yml:196–208` (`deploy-rules` job); GitHub run `33967909724` on `main` (2026-09-05): *"Firestore rules were NOT deployed: configure the FIREBASE_SERVICE_ACCOUNT repository secret…"*
- **Risk:** `firestore.rules` is the entire server-side authorization model (RBAC, entitlements, invitation claims). The deploy step refuses to run without the repo secret, so whatever rules are live in the Firebase project were deployed by hand at some unknown commit. The client write contract and the server authorization contract can diverge — the failure mode the repo itself documents is "every budget write 403s" (availability), and the inverse (older, weaker rules live) is an authorization risk. The red `main` badge also normalizes "red is fine", which erodes the release gate (`PRODUCTION_CHECKLIST.md` §1 lists a green pipeline as BLOCKER).
- **One-click remediation (config only):**
  1. GitHub → Settings → Secrets and variables → Actions → New repository secret: `FIREBASE_SERVICE_ACCOUNT` = a **Firestore-rules-deploy-scoped** service-account JSON (roles: `roles/datastore.user` on the project is sufficient for rules/index deploy; do **not** use an Editor/Owner key).
  2. Same page → Variables: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
  3. Re-run the `deploy-rules` job; confirm `main` is green and capture the deployment output per `PRODUCTION_CHECKLIST.md` §3.
  4. Add branch protection on `main`: require `check` + `e2e` to pass (Settings → Branches).

**🟠 H-2 — Firebase App Check not integrated (no request attestation on Firestore/Auth/API)**
- **Where:** gap — `src/lib/firebase.ts:57` initializes Auth/Firestore with no `initializeAppCheck`; no `app-check` reference in `src/` or `package.json`. The repo's own checklist defers it: `PRODUCTION_CHECKLIST.md:149–160` (unchecked `[EXTERNAL]`).
- **Risk:** Firebase web config (API key, project id, app id) is public by design. Authorization is enforced by rules (good), but rules cannot see *volume* or *client genuineness*: a scripted client that signs up can drive Firestore at line rate (cost/billing abuse, scraping everything its account may read, hammering the invitation mail budget across many accounts), and can POST `/api/*` outside any browser. This is the web equivalent of "fake device/emulator usage" from the mobile brief.
- **One-click remediation:** appendix A.1 — ~10 lines to add App Check in **monitoring mode** (zero user friction), then the console checklist to move to enforcement. Free tier of reCAPTCHA v3 is sufficient at this scale.

**🟠 H-3 — No MFA/2FA for email+password accounts (finance app)**
- **Where:** gap — no `multiFactor` API usage in `src/` (verified by grep); sign-up/sign-in flows in `src/lib/auth-context.tsx:181–230, 283–295`.
- **Risk:** Account takeover via credential stuffing/phishing is the primary ATO path for password accounts. The app deliberately supports Google sign-in (which brings the provider's own risk engine) but email+password accounts get only Firebase's default rate limiting. A household's budgets, debts and receipts are exactly the data class where regulators and users expect MFA.
- **One-click remediation:** enable **TOTP** in Firebase console (Authentication → Sign-in method → Tune → "Multi-factor authentication"; free). Enforcement can be phased: encourage → require for household owners. Enrollment UI snippet in appendix A.3 (~40 lines). Consider nudge-to-Google for password users.

**🟡 M-1 — Anti-abuse stack is opt-in and currently inert**
- **Where:** `src/lib/server/arcjet.ts:19–53` (dynamic import gated on `ARCJET_KEY`, fail-open by design); `src/lib/server/rate-limit.ts:92–100` (falls back to per-instance in-memory counters when `UPSTASH_REDIS_REST_URL`/`TOKEN` are unset — the file's own header doc says a horizontally scaled deployment multiplies each route's real limit by the instance count and forgets on cold start).
- **Risk:** On Vercel serverless, unset Upstash ⇒ the contact route's "5 per 10 min" and the invite route's "8 per 10 min" become *N× those numbers* across lambdas, resetting on every cold start. Unset Arcjet ⇒ no SQLi/XSS-pattern shield and no bot scoring on the two mail-sending public endpoints. All of it is one environment change away from working.
- **Remediation:** set the four Vercel env vars (appendix A.2). No code changes. Verify by observing `rl:*` keys in the Upstash console under load.

**🔵 L-1 — Contact-form idempotency dedupe is per-instance memory**
- **Where:** `src/app/api/contact/route.ts:31–45` (`seenRequestIds` Map, per lambda).
- **Risk:** double-send across instances within the 30-min dedupe window (minor mail spam; Resend-side idempotency key is used for invitations but not for contact).
- **Remediation:** pass `idempotencyKey: \`contact-${payload.requestId}\`` to `resend.emails.send` (mirrors `household-invitations/route.ts:316–322`); optionally move dedupe into the Redis limiter. 2-line change.

**🔵 L-2 — Trial farming: launch-trial claim is one-per-account but unlimited-accounts**
- **Where:** `firestore.rules:51–68` (`validLaunchTrialClaim` — solid: server-clock-bounded, exact 90-day projection, single-claim enforced via `proTrialClaimedAt`).
- **Risk:** a fraudster can mint disposable accounts for repeated 90-day Pro trials. No verified-email requirement on the claim path.
- **Remediation (no/low code):** require email verification before trial claim (add `verifiedEmail()` to the rule conjunction — 1-line rules change + client nudge), and alert on trial-claim velocity per IP in Firebase monitoring. Accept as marketing cost if volume stays low.

### 3.2 Anti-reverse engineering (web equivalent)

The classic mobile objectives — hiding secrets from the binary, defeating tampering/debugging — translate here to *keeping the client bundle free of anything sensitive* and *raising the cost of scripted abuse*. Result: **clean**.

- ✅ **No exposed API keys / hardcoded secrets** — pattern scan across `src/`, `scripts/`, `ci/`, `.github/`, `messages/`, `demo/`, `firebase-blueprint.json`, and git history found nothing. `RESEND_API_KEY`, `ARCJET_KEY`, `UPSTASH_*`, `SENTRY_DSN`, `BETTERSTACK_API_KEY` are all server-only (`src/lib/server/*`, read via `process.env` at runtime; `.env.example` explicitly marks them "never expose to browser").
- ✅ **`NEXT_PUBLIC_FIREBASE_*` values are public identity, not secrets** — and the code treats them accordingly (`firebase.ts:8–36`); the invitation route even documents why the project id (public) replaced the API key as the token-pinning value.
- ✅ **No debug mode / verbose errors in production** — `next.config.mjs` sets `reactStrictMode`, strips `X-Powered-By`; error boundaries send sanitized beacons and render localized messages; API routes return stable `code`s, never stack traces (`household-invitations/route.ts:312–319`); provider errors are logged server-side only.
- ✅ **No production source maps served** (`productionBrowserSourceMaps` not enabled — Next default; no override in `next.config.mjs`).
- 🟡 **M-4 — CSP `script-src 'unsafe-inline'`** — `src/proxy.ts:68–83`, documented as accepted risk "S4" with the rationale (36 prerendered routes would all become dynamic under per-request nonces; no user-controlled HTML is rendered anywhere — verified: the only `dangerouslySetInnerHTML` sinks are static layout JSON-LD, a fixed capture script, and a fixed language bootstrap). Compensating controls are real: `script-src-attr 'none'` (kills inline handlers), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, React escaping, COOP/CORP. **Residual risk: a future dependency that renders attacker strings into inline `<script>` context.** Revisit hash-based CSP when Next supports it for prerendered output; track as permanent accepted risk until then.

### 3.3 API security

Four endpoints audited line-by-line: `/api/contact`, `/api/household-invitations`, `/api/barcode/lookup`, `/api/client-errors`.

| Check | Result |
|---|---|
| Unauthenticated access to privileged operations | ✅ None — invitations require a verified Firebase ID token (`RS256`-pinned, issuer/audience-bound, `src/lib/firebase-id-token.ts`); contact/barcode/errors are public by design and return no user data |
| BOLA / IDOR | ✅ Invitation mail re-reads the invite **as the caller** (rules-mediated); household reads all flow through rules with per-role `memberRole()`/`customLevel()` gates |
| SQL/NoSQL injection | ✅ N/A by construction (Firestore, no query strings composed from user text; the one upstream fetch is locked to five fixed OFF hosts with a `^[0-9]{8,13}$` code regex — `barcode/lookup/route.ts:31–37,107`) |
| Rate limiting | ✅ All routes (see §2.3) — durability depends on M-1 config |
| Input validation | ✅ Hand-rolled but complete: length caps, regex email, role allow-list, `expiresAtMs` finiteness, inviteId charset — plus Zod on all client form entry (`src/lib/validation.ts`) |
| SSRF / path traversal | ✅ Barcode proxy: fixed host allow-list, numeric-only path segment, 12 s global deadline; invite link base: env/platform values only, never `Host` |
| Mass assignment | ✅ Recipient email never accepted from the request body on either mail route |
| HTTPS enforcement | ✅ `upgrade-insecure-requests` in CSP + HSTS `max-age=63072000; includeSubDomains; preload`; Vercel TLS-terminates |
| Certificate "pinning" (web equivalent) | ✅ HSTS preload is the correct web control; NA-3 covers the mobile sense |
| Data leakage in responses | ✅ DTO-shaped JSON (`code` + `hint`), environment string only in readiness probes (L-3 below); `Cache-Control: no-store` on every API response (`src/proxy.ts:137–141`) |
| Log injection | ✅ Fields clipped, `JSON.stringify`-encoded before `console.error` (`client-errors/route.ts:26–54`) |

**🔵 L-3 — Readiness probes disclose the deployment environment string** — `contact/route.ts:108`, `household-invitations/route.ts:194` return `"environment": "production"|"preview"|…`. Harmless alone (it mirrors the deployment's own behavior), but drop the field on unauthenticated 200s if you want a tighter surface.

**🔵 L-4 — Signup reveals account existence** (`auth/email-already-in-use` → "An account with this email already exists", `src/lib/auth-errors.ts:57–58`). Standard, low-risk tradeoff; login path is correctly unified (`invalid-credential`). **Action:** keep Firebase's *Email Enumeration Protection* enabled (console → Authentication → Settings → User actions) so the signup path also can't be probed via the reset flow; the generic reset response already helps.

**🔵 L-5 — `x-forwarded-for` trust is platform-dependent** (`contact:161–164`, `client-errors:33`, `barcode:107–110`). Correct on Vercel (platform-set); spoofable if the app is ever self-hosted behind a proxy that doesn't sanitize it. Guard with a comment or a `VERCEL` runtime assert if a Dockerfile ever lands (the `next.config.mjs` note suggests that door is open).

### 3.4 Runtime protection (RASP) — mobile-item mapping

| Mobile brief item | Web/PWA reality | Status |
|---|---|---|
| Root/jailbreak detection | Browser sandbox — device trust is the OS vendor's domain; App Check (H-2) is the available attestation | NA / covered by H-2 |
| Frida / hooking frameworks | No native code to hook; client JS integrity protected by CSP + same-origin + (optional) `integrity` on SW-imported scripts | NA |
| Overlay attacks | Browser cannot be overlaid by the page itself; Android overlay trojans are a device-malware problem — mitigate user-side with MFA re-auth for destructive actions (H-3) | Partially via H-3 |
| Screen recording detection | Not detectable in browser; PWA screenshots of finance data are user-permitted behavior | NA (note in privacy page) |
| Tamper detection | Deploy immutability on Vercel + content-hashed assets + SW `must-revalidate` for `sw.js` | ✅ |
| Clickjacking | `frame-ancestors 'none'` fail-closed in prod; `X-Frame-Options: SAMEORIGIN` prod-only (documented, `next.config.mjs:1–9`) | ✅ |
| XSS | React escaping + CSP (M-4 accepted residual) + `script-src-attr 'none'` + zero user-HTML sinks | ✅ |
| Tabnabbing | All `target="_blank"` links verified to carry `rel="noopener noreferrer"` (grep: none unguarded) | ✅ |
| XS-Leaks / cache confusion | `Cross-Origin-Resource-Policy: same-origin` (assets exempted deliberately), private routes `private, no-store`, COOP `same-origin-allow-popups` for the Firebase popup handshake | ✅ |
| ⚪ I-1 — SW offline cache holds last-visited private-page HTML | Prerendered shells contain no user data (data arrives post-hydration over Firestore); acceptable | `public/sw.js:96–121` |
| ⚪ I-2 — Firebase SDK persists auth + offline data in IndexedDB unencrypted | Platform-standard for Firebase JS SDK; device-level encryption (iOS Data Protection / Android FBE) is the compensating control | Accept; document |

### 3.5 Data privacy & compliance

Detailed compliance checklists are in §6. Code-level findings here:

**🟡 M-2 — Financial data cached unencrypted in `localStorage`**
- **Where:** month snapshots + savings goals: `src/components/dashboard/dashboard-provider.tsx:430, 621, 1032–1040` (`writeCachedMonth`, `flousy_household_*_savings_goals`); course-session drafts: `src/hooks/use-course-session.ts:36–45`; onboarding flags: `src/app/onboarding/page.tsx:88–396`.
- **Risk:** on a shared/borrowed device, another user (or any extension with `localStorage` access) can read budgets, debts, goals and receipt-derived notes without unlocking the PWA. **Strong mitigations already present:** everything is wiped on sign-out (`auth-context.tsx:337–339 clearLocalData()`), demo residue is cleared on real sign-in (`auth-context.tsx:185–189`), and Firestore writes are the source of truth.
- **Remediation (pick one, in order of value/effort):** (a) add an inactivity lock — after N minutes hidden, require re-auth (`auth.currentUser.getIdToken()` round-trip or `WebAuthn`/password re-entry) before rendering the dashboard; (b) move month/goal *draft* caches to `sessionStorage` so they die with the tab; (c) accept, and state the shared-device caveat in `/privacy`. Full WebCrypto-at-rest is possible but disproportionate for a client-side cache whose canonical store is rules-protected Firestore.

**🟡 M-5 — No breached-password screening; project-level password policy unconfirmed**
- **Where:** `src/lib/validation.ts:108–115` (10-char floor, 128 cap — no complexity, no breach check); `PRODUCTION_CHECKLIST.md:116` (policy review is an unchecked external item).
- **Remediation:** configure the Firebase Auth password policy (console; enforced server-side at sign-up — **no code change**), and screen new passwords against the HaveIBeenPwned k-anonymity range API at sign-up (one `fetch` + SHA-1 prefix; ~15 lines) or via a Cloud Function before create.

**Positive:** consent-gated analytics (opt-in, `flousy_analytics_consent`), no cookies at all (Bearer-token API calls ⇒ **CSRF is structurally N/A**), no third-party trackers beyond consented Firebase Analytics, no PII in server logs by design, GDPR export (CSV+JSON) and verified erasure flows, `/privacy`, `/terms`, `/cookies` pages. Processor list (Firebase/GCP, Vercel, Resend, optional Arcjet/Upstash/Sentry/Better Stack) is known — **DPAs + transfer mechanisms are external paperwork tasks**, tracked in `PRODUCTION_CHECKLIST.md` §7.

**⚪ I-3 — Invitee emails persist in `householdInvites` after resolution.** Rules correctly gate reads (`invitedBy == auth.uid` / household owner), but pending/declined invite rows hold third-party emails indefinitely. Add a TTL sweep (delete rows `status != 'pending'` older than N days) in the existing migration-script pattern, or document retention in `/privacy`.

### 3.6 Third-party SDK risk

| SDK (runtime) | Version | Client/server | Data it touches | Verdict |
|---|---|---|---|---|
| `firebase` | 12.16.0 (latest 12.18.0) | Client (+REST server verify) | Auth identity, finance docs (rules-gated), consent-gated analytics | ✅ First-party-grade; update available |
| `@zxing/browser` | 0.2.1 | Client | Camera frames (local decode only; no upload) | ✅ Minimal |
| `resend` | 6.18.1 | Server only | Transactional email (invitee address, escaped body) | ✅ |
| `@arcjet/next` | 1.11.0 | Server only | Request metadata on public routes — **inert until keyed (M-1)** | ✅ design |
| Radix UI, lucide, embla, etc. | current | Client | UI only, no network | ✅ |
| Google Analytics (via Firebase) | — | Client | **Off until consent** (`analytics.ts:23–49`) | ✅ |

`npm audit`: **0 vulnerabilities** across 656 dependencies (prod 257 / dev 399). All SDK permissions surface is browser-API-scoped: `Permissions-Policy: camera=(self), microphone=(), geolocation=()` — deliberately keeps the barcode scanner alive while denying everything else (`next.config.mjs:29–31`). No SDK receives data before its consent gate except strictly necessary infrastructure (Firebase Auth/Firestore — legitimate interest/contract under GDPR).

### 3.7 Binary & supply chain

**🟠 (rolled into H-1)** — the rules-deploy pipeline is the one supply-chain link not closed.
**🟡 M-6 — Dependency/update automation gaps**
- `.github/` has **no `dependabot.yml`** (verified). Updates land via manual bumps; the only automated net is the CI `npm audit --omit=dev` gate (well-engineered — distinguishes advisory-found from registry-unreachable, `ci.yml:27–58` + `scripts/audit-summary.mjs`).
- Actions referenced by mutable tags: `actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-java@v4`, `actions/upload-artifact@v4` (`ci.yml:15,17,22,152,175`). A compromised tag = code execution in CI with access to `FIREBASE_SERVICE_ACCOUNT`. GHSA advisories against `actions/*` and third-party `uses:` (none third-party here — good) make SHA-pinning the standard control.
- **Remediation:** appendix A.4 (Dependabot config) + pin refs to commit SHAs (commands included). 30 minutes total.
- ⚪ I-4 — Runner deprecation warnings on the latest run (actions targeting Node 20 forced to Node 24; `setup-java@v4` deprecated) — cosmetic today, update when Dependabot is on.

**⚪ I-5 — Next.js 16.3.4 advisory posture** — verified current against the 2026 advisory stream: Aug-2026 critical RCE pair (fixed 16.3.3) ✅, Jul-2026 CVE-2026-64642 (middleware/proxy bypass, Turbopack single-locale — fixed 16.2.11) ✅, and this app's `proxy.ts` performs **no authorization decisions** (headers/cache only — data authz lives in Firestore rules), so even a hypothetical proxy bypass would not gate data access. Vercel hosting additionally neutralizes the AVIF/libheif class. ✅

---

## 4. Backend Production Readiness — 20-concept scorecard

| # | Concept | Status | Evidence / gap |
|---:|---|:---:|---|
| 1 | Authentication | 🟡 | Firebase Auth (OAuth Google + email/pw); password hashing is Google-managed (Argon2/bcrypt N/A but equivalent); **MFA missing (H-3)**; unified credential errors ✅; enumeration protection to confirm in console |
| 2 | Authorization | 🟢 | Firestore rules = RBAC+ABAC (owner/editor/writer/viewer/contributor/custom per-area), default-deny, tested in emulator; client-side permissions never trusted (`area-restricted.tsx` is cosmetic only); invitation acceptance binds `acceptedByUserId == auth.uid` |
| 3 | Endpoint security | 🟢 | All privileged endpoints authn'd (Bearer, RS256-pinned); HTTPS-only enforced (HSTS preload); unused endpoints don't exist; robots.txt disallows `/api/` |
| 4 | Input validation | 🟢 | Every route validates type/length/format/range (hand-rolled, tested); Zod on client forms; **note:** server routes don't use Zod — acceptable given the coverage, consider `safeParse` reuse for drift protection |
| 5 | Injection protection | 🟢 | NoSQL by construction; no string-composed queries; upstream fetch host-allow-listed; Arcjet shield available behind M-1 |
| 6 | JWT security | 🟢 | RS256 only (`alg` ignored, not honored), issuer/audience pinned, 1-h expiry inherent, revocation best-effort check, no tokens in logs (verified design + checklist item §8) |
| 7 | Password security | 🟡 | Google-managed hashing ✅; 10-char new-account floor ✅; **breach check missing, project policy unconfirmed (M-5)**; account lockout via Firebase rate limiting ✅ |
| 8 | Rate limiting | 🟡 | All routes limited ✅; Redis-durable path built ✅; **not durable until Upstash is keyed (M-1)**; CAPTCHA-equivalent = Arcjet bot detection (same M-1) + honeypot ✅ |
| 9 | CORS | 🟢 | No `Access-Control-Allow-Origin` is emitted anywhere (same-origin-only API) — verified by grep; credentials never ride CORS |
| 10 | Environment variables | 🟢 | Zero secrets in tree/history; `.env*` git-ignored with example file; server/client split correct; secret managers to consider only at scale |
| 11 | Sensitive data in responses | 🟢 | Code-shaped errors, DTO discipline, no stack traces, `no-store` on APIs; readiness probes disclose only environment name (L-3) |
| 12 | Error handling | 🟢 | Generic client messages + internal `console.error` detail; correlation via `requestId` on contact; error boundaries report sanitized beacons |
| 13 | File upload security | 🟢 | Only images, client-side re-encoded to JPEG data URLs ≤100 KB (`receipt-image.ts`), MIME-sniffed via decode, size-capped at 15 MB pre-resize; no server filesystem; no cloud-storage URLs |
| 14 | Database security | 🟢 | Firestore: no open ports/default creds possible; IAM via rules; at-rest encryption by Google default; region choice = residency decision tracked in checklist §3; least-privilege service account recommended for deploy secret (H-1) |
| 15 | Database performance | 🟢 | Composite indexes in `firestore.indexes.json`; pagination via bounded queries; N+1 avoided with snapshots; slow-query monitoring is external (checklist §8) |
| 16 | Data integrity | 🟢 | Rules enforce money ranges, period state machines (closed/reopen transitions), revision bumps, mutation ledgers (`mutationLedger()`, `ledgerRowAgrees()`), `runTransaction` for erasure; constraints tested in emulator |
| 17 | API validation | 🟡 | Request validation complete; no OpenAPI spec (4 routes — acceptable; generate one before adding a 5th) |
| 18 | Logging & monitoring | 🟡 | Structured single-line `[client-error]` sink ✅; sinks (Sentry/Better Stack) built but inert without env vars (M-1 family); alerting, quotas, cost anomalies = checklist §8 external items |
| 19 | Testing | 🟢 | 489 unit tests + Firestore emulator authorization suite + Playwright E2E + lint + strict typecheck, all in CI ✅ (CI red only on the unconfigured deploy step, H-1); SAST/DAST not in CI yet (see §8 tools) |
| 20 | Production configuration | 🟡 | `NODE_ENV=production` on deploys ✅; headers/CSP tested ✅; **debug-log posture:** dev-only console noise acceptable; HSTS/CSP/XFO verified; env matrix documented but prod vars partially unset (H-1/M-1) |

**Bonus layers:** CSRF — **N/A, structurally** (no cookies; Bearer headers + Firestore SDK) ✅ · Session management — Firebase token storage in IndexedDB, 1-h tokens auto-refresh; **no idle timeout (M-3)** · Security headers — ✅ tested · XSS — ✅ · SSRF/Path traversal — ✅ · Secrets management — ✅ (rotation runbook = checklist §8 item) · Dependency security — audit gate ✅, **automation missing (M-6)** · Backup & DR — checklist §10 external items open (Firestore export schedule, restore rehearsal) · Incident response — checklist §8 defines channel/owners/severities, runbook content external.

**Deployment checklist verification (your 5 items):**
1. *Tests in CI before push* — ✅ enforced (`check` + `e2e` jobs; not branch-required yet → add branch protection, H-1 step 4).
2. *Security scans in CI* — 🟡 dependency audit ✅; add Semgrep/CodeQL + gitleaks (§8).
3. *Env vars verified* — 🟡 documented in checklist §4; the `deploy-rules` guard proves the pattern works — apply it to the web deploy too.
4. *Logs free of sensitive data* — ✅ by design (finance payloads never logged; verified in all 4 routes + reporter); manual smoke check remains in checklist §8.
5. *Backups working* — 🔴 not evidenced (checklist §10 unchecked): schedule Firestore exports + do one restore rehearsal **before** launch.

---

## 5. Remediation backlog (consolidated, one-click first)

| ID | Fix | Type | Effort | Appendix |
|---|---|---|---|---|
| H-1 | Add `FIREBASE_SERVICE_ACCOUNT` secret + project variable; require checks on `main`; verify live rules match the audited file | Config | 15 min | §3.1 |
| M-1 | Set `UPSTASH_REDIS_REST_URL/TOKEN`, `ARCJET_KEY` (and optionally `SENTRY_DSN`, `BETTERSTACK_API_KEY`) per Vercel environment | Config | 30 min | A.2 |
| H-2 | App Check: add init snippet (monitoring) → console registration → enforcement after clean window | Snippet + console | 0.5 d | A.1 |
| H-3 | Enable TOTP MFA in console; ship enrollment UI; (optional) require for household owners | Console + snippet | 0.5–1 d | A.3 |
| M-6 | Add `dependabot.yml`; SHA-pin 4 action refs; update deprecated runner versions | Config | 30 min | A.4 |
| M-3 | Session policy: keep local persistence (offline-first PWA) but add inactivity re-auth gate for `/dashboard` (N-min hidden → re-auth) | Snippet | 0.5 d | A.5 |
| M-2 | Inactivity lock (above) covers the shared-device risk; optionally move month/goal draft caches to `sessionStorage` | Code | +0.5 d | A.5 |
| M-5 | Firebase password policy (console) + HIBP k-anonymity check at sign-up | Console + 15 LOC | 1 h | A.6 |
| L-1 | Resend `idempotencyKey` on contact sends | 2 LOC | 15 min | — |
| L-2 | Drop `environment` from unauthenticated readiness responses | 2 LOC | 15 min | — |
| L-3 | Comment/assert platform proxy for `x-forwarded-for` trust | 1 LOC | 5 min | — |
| L-4 | Confirm Email Enumeration Protection ON in Firebase console | Console | 5 min | — |
| L-5 | Add `verifiedEmail()` to `validLaunchTrialClaim()` + client nudge; monitor claim velocity | 1 rule line | 1 h | — |
| L-6 | Keep the rules expression-budget gate green; split any rule that regresses over the cap (CI already measures it) | Ongoing | — | — |
| I-3 | TTL sweep for non-pending `householdInvites` (third-party email retention) | Script | 2 h | — |
| M-4 | Re-evaluate nonce/hash-based CSP when Next.js supports it for prerendered output | Tracked risk | — | — |

---

## 6. Compliance checklists

### 6.1 GDPR (applicable — EU/EA users plausible; controller = the operating entity)

| Requirement | Status | Evidence / action |
|---|:---:|---|
| Lawful basis & consent (analytics) | ✅ | Opt-in gate before any Analytics load (`analytics.ts:23–49`, `analytics-consent-toggle.tsx`) |
| Transparency (`/privacy`, `/cookies`) | ✅ | Pages exist and are linked; keep processor list current when Arcjet/Upstash/Sentry go live |
| Data minimization | ✅ | Finance data only; no ad IDs; no third-party trackers; camera frames decoded locally |
| Access / portability | ✅ | CSV month export + full JSON backup (`data-panel.tsx`, `finance-backup.ts`) |
| Rectification | ✅ | Full profile/household editing |
| Erasure | ✅ | Re-auth → verified wipe → account delete (`auth-context.tsx:375–381`, `db.ts:1232–1300`) |
| Integrity & confidentiality | ✅ | TLS, rules-based access control, no PII in logs |
| Storage limitation | 🟡 | Add invite-email TTL sweep (I-3); define backup retention (checklist §10) |
| Processor agreements (Art. 28) | 🔴 external | DPAs for Firebase/GCP ✓ (Google standard terms), **Vercel, Resend, and (when enabled) Arcjet/Upstash/Sentry/Better Stack** — sign/verify DPAs + SCCs where relevant |
| Records of processing (Art. 30) | 🔴 external | Draft from §2.3 + processor table (§3.6) |
| Data-residency decision | 🔴 external | Firestore region choice flagged in checklist §3 — decide before production data lands |
| Breach notification runbook (Art. 33/34) | 🟡 | Channel/severity scaffold in checklist §8; write the 72-h runbook |
| DPIA | 🟡 | Finance data + household sharing = likely "high risk to individuals"; a short DPIA is cheap insurance |

**GDPR verdict: Strong technical compliance; four paperwork items (DPAs, ROPA, residency, DPIA/runbook) block a clean claim.**

### 6.2 HIPAA

**Out of scope — conditionally N/A.** The app stores no PHI, no health-adjacent categories, and is not offered as a covered-entity service. It becomes in-scope only if it ever stores health data for a covered entity — at which point you need: a BAA with Google Cloud (Firebase is BAA-eligible on paid plans; **Analytics must be disabled** for PHI workloads), workforce access controls, audit logging, and encryption-key management. No action today beyond a product-side "don't put medical data here" stance.

### 6.3 PCI DSS

**Out of scope — no cardholder data exists.** The Pro tier is a rules-enforced launch trial; **no payment processor is integrated** (verified: no Stripe/PayPal/IAP code; `ProUpgradeModal` handles trial timestamps only). Keep it that way for launch:
- When billing arrives, use **hosted checkout / payment-element fields** (Stripe et al.) so PAN data never touches your servers ⇒ SAQ-A scope, ~20 controls instead of ~250.
- Never log entitlement/purchase tokens alongside user emails (current logging discipline already supports this).
- The "billing-disabled launch" (checklist §6) is consistent with staying out of scope.

---

## 7. Tooling — free & paid alternatives (Raspir et al.)

> Note: no widely-adopted scanning product ships under the name "Raspir" in mainstream channels — treat it as the commercial RASP category representative. The mapping below is calibrated to **this codebase today** and **the native-mobile shells you may ship later**.

**For this app (web/PWA) — use these now:**

| Need | Free | Paid |
|---|---|---|
| RASP-equivalent runtime protection | **Arcjet** (already integrated — just key it, M-1): shield + bot detection + rate limiting at the edge | Arcjet paid tiers; Cloudflare WAF Managed Rules in front of Vercel DNS |
| API protection/schema enforcement | The 4 routes + Zod + rules (current design); OWASP API Security Top-10 as review rubric | **Cloudflare API Shield** (schema validation, mTLS, session fingerprints) if/when API surface grows or DNS moves to Cloudflare |
| SAST | **Semgrep** (OSS rulesets: `p/owasp-top-ten`, `p/typescript`) or **CodeQL** — add one CI job | Snyk Code / Semgrep AppSec |
| DAST | **OWASP ZAP** baseline scan against a preview deployment (the repo's `probe-headers.mjs` already does the header half) | Burp Suite Pro for a one-off manual pentest before launch |
| Secrets scanning | **Gitleaks** or **TruffleHog** pre-commit + CI | GitHub Secret Push Protection (built-in) |
| Dependency scanning | **Dependabot** (appendix A.4), `npm audit` gate ✅, **Renovate** (better batched PRs) | Snyk Open Source |
| Checklist/rubric | **OWASP ASVS 4.x** (web) + **OWASP WSTG**; MASVS below for mobile | — |

**For the future native shells (if you wrap this PWA with Capacitor, or build RN/Flutter):**

| Need | Free | Paid |
|---|---|---|
| Automated mobile scanning | **MobSF** (Docker, static + dynamic; APK/IPA/RN/Flutter source) — the direct "free Raspir" | MobSF-based commercial scanners; **Snyk Mobile**-style offerings via Snyk Container/Open Source bundles |
| Security requirements checklist | **OWASP MASVS 2.x + MASTG** (the mobile counterpart of what you asked to reference) | NowSecure, Ostorlab |
| RASP / anti-tamper / anti-hooking / obfuscation | Free tier: Firebase **App Check** with Play Integrity (Android) / DeviceCheck+App Attest (iOS); ProGuard/R8 (Android default shrinking+obfuscation); Swift symbol stripping | **Guardsquare** (DexGuard for Android, iXGuard for iOS), **Appdome** (no-code fused RASP), OneSpan **iOS App Shielding**, Promon SHIELD |
| Attestation/anti-fraud | Play Integrity API, Apple App Attest (free) | Device fingerprinting vendors (only if fraud volume justifies) |

The "one-click, no-code" vendor path for mobile RASP is exactly Appdome or Guardsquare; for this web app the equivalent one-click is **Arcjet + App Check**, both already integrated in code and awaiting keys (M-1, H-2).

---

## 8. Technical appendix (developers)

### A.1 App Check — monitoring mode (H-2)

`src/lib/firebase.ts`, after line 57 (`auth = getAuth(app)`):

```ts
// Firebase App Check — attests that Firestore/Auth traffic comes from this app.
// Start in MONITORING (no enforcement) per PRODUCTION_CHECKLIST §3; flip the
// project to ENFORCE only after a clean monitoring window.
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

if (app && typeof window !== 'undefined') {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY as string,
    ),
    isTokenAutoRefreshEnabled: true,
  });
}
```

Guard it on the key being present (same pattern as `firebaseConfig`) so keyless preview/demo deploys stay inert. Console steps: Firebase → App Check → Apps → register web app with the reCAPTCHA v3 site key → metrics for 1–2 weeks → "Enforce" for Firestore + (optionally) Storage. Add `https://www.google.com` to CSP `connect-src` if the reCAPTCHA fetch is CSP-blocked (test in preview). Server-side: the invitation route can later require App Check tokens too, but the client-attested Firestore path is the high-value one.

### A.2 Vercel environment variables (M-1) — Project → Settings → Environment Variables, set per environment

```
UPSTASH_REDIS_REST_URL=https://…upstash.io      # durable cross-instance rate limits
UPSTASH_REDIS_REST_TOKEN=…                      # server-only
ARCJET_KEY=ajkey_…                              # shield + bot detection on public API routes
SENTRY_DSN=https://…                            # optional: server-side error-sink forwarding
BETTERSTACK_API_KEY=…                           # optional: same reports → Logtail
RESEND_FROM_EMAIL=SmartJib <no-reply@flousy.app># verified domain — sandbox sender is 503'd in prod by design
```

Verify: hit `/api/contact` readiness (expect `code: "ready"`), then send 6 messages in 10 minutes from one IP (expect 429) — check the Upstash console for `rl:contact:*` keys to prove durability.

### A.3 TOTP MFA enrollment (H-3) — minimal client sketch

```ts
import { multiFactor, TotpMultiFactorGenerator, TotpSecret } from 'firebase/auth';

export async function enrollTotp(user: User, displayName: string) {
  const session = await multiFactor(user).getSession();
  const secret: TotpSecret = await TotpMultiFactorGenerator.generateSecret(session);
  const otpauth = secret.generateQrCodeUrl(displayName, 'SmartJib');
  // render `otpauth` as a QR; then on code submit:
  // await secret.verifyEnrollment(code); await multiFactor(user).enroll(assertion, 'Authenticator app');
}
```

Console: Authentication → Sign-in method → Multi-factor → TOTP ON. Enforcement options: (a) UI-level — require `user.multiFactor.enrolledFactors.length > 0` before household-owner actions; (b) later, App Check + custom claims via a Cloud Function if you need hard enforcement.

### A.4 Dependabot (M-6) — `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      minor-and-patch:
        update-types: [minor, patch]
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

**SHA-pin actions** (replace `@v4` tags; resolve current SHAs with `git ls-remote https://github.com/actions/checkout v4` etc., and add a version comment):

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
```

### A.5 Session hardening (M-3/M-2)

Keep `browserLocalPersistence` (the PWA's offline-first promise), add an inactivity gate in `dashboard-shell.tsx`: track `document.visibilityState` + last-interaction; after N=15 min hidden, set `requireReauth` and render a lightweight "Unlock" panel that calls `signInWithEmailAndPassword` (or `reauthenticateWithCredential`) before unmounting the gate. Optional: switch the month/goal *draft* caches (`dashboard-provider.tsx:1032`) to `sessionStorage`.

### A.6 Breached-password check (M-5) — sign-up only, k-anonymity (password never leaves)

```ts
const sha1hex = (await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pw)))
  .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '').toUpperCase();
const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1hex.slice(0, 5)}`);
const breached = (await res.text())
  .split('\n').some((l) => l.split(':')[0].trim() === sha1hex.slice(5));
```

Reject with the existing weak-password copy when `breached`. Plus console: Authentication → Settings → Password policy → min 10.

### A.7 Security-relevant file map (for reviewers)

| Area | Files |
|---|---|
| Edge policy (CSP/cache/frame) | `src/proxy.ts`, `next.config.mjs` |
| API routes (authn/authz/limits) | `src/app/api/{contact,household-invitations,barcode/lookup,client-errors}/route.ts` |
| Server libs | `src/lib/server/{rate-limit,arcjet,telemetry}.ts` |
| Identity | `src/lib/{firebase,firebase-id-token,auth-context,auth-errors,demo-mode}.ts(x)` |
| Server-side authorization | `firestore.rules` (+ `tests/firestore-rules.emulator.ts`, `scripts/rules-{budget,totality}.mjs`, `firestore.totality-baseline.json`) |
| Client data at rest | `src/components/dashboard/dashboard-provider.tsx`, `src/hooks/use-course-session.ts`, `public/sw.js` |
| Export/import | `src/lib/{export,csv-import,finance-backup}.ts` |
| Pipeline | `.github/workflows/{ci,diag-rules}.yml`, `ci/README.md`, `scripts/audit-summary.mjs` |

### A.8 Audit evidence log

- `npm ci` clean; `npm test` → **489/489 pass** (2026-09-05, this tree).
- `npm audit` (lockfile, 656 deps) → **0 vulnerabilities**.
- Secret pattern scan (incl. `git log --all --diff-filter=A -- .env*`) → **0 hits**.
- `gh run view 33967909724` → `check` ✓ (lint, typechecks, 489 tests, rules emulator), `e2e` ✓, `deploy-rules` ✗ (unconfigured secret — finding H-1).
- Version cross-check: `next 16.3.4` (latest; ≥16.3.3 Aug-2026 fixes, ≥16.2.11 CVE-2026-64642 fix), `firebase 12.16.0` (latest 12.18.0 — routine update), `zod 3.25.76` (v4 exists — major, no advisory), `react 19.2.7` (current).

---

*End of report. Residual risk statement: with H-1 and M-1 remediated (pure configuration), this application's security posture is consistent with its documented production checklist and is cleared for a soft launch; H-2/H-3 should land within the first post-launch sprint.*
