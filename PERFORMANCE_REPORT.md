# Performance Investigation & Fixes — SmartJib / Smartjib

> **Historical measurement note (2026-09-02):** this report preserves results
> from the named 2026-08-30 snapshot; bundle sizes, route symbols and local TTFB
> are not release evidence for the current Next.js 16 tree. The former
> `src/middleware.ts` policy now lives in `src/proxy.ts`. Re-run production
> Lighthouse/real-device checks and record them in
> [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md) before launch.

Date: 2026-08-30 · Branch: `arena/01a0504b-smartjib-app`

Goal: find why navigation/loading felt slow and make the app score green on
PageSpeed Insights (the Google "speed test") — with CDN/Cloudflare-friendly
caching so the edge can actually serve the pages.

---

## 1. Root causes found (deep investigation)

### 1.1 Every page was server-rendered on every request — no CDN caching 🚨
The root layout (`src/app/layout.tsx`) exported `dynamic = 'force-dynamic'`,
and `src/middleware.ts` generated a **fresh CSP nonce per request**. A nonce
can only match the HTML if the page is rendered per request, so even the
marketing home page was rendered by the server on every single visit:

- each visitor paid a full server round-trip (TTFB) before anything painted;
- Vercel/static caching could never hold the HTML;
- PageSpeed's repeated loads measured the same slow TTFB every time.

### 1.2 The Firebase SDK was bundled into every page 🚨
`AppProviders` (AuthProvider → Firebase auth + Firestore + Analytics) wrapped
**all** routes from the root layout, and `FirebaseAnalytics` was also in the
root layout. Result: the home/blog/legal pages downloaded, parsed and
hydrated the whole Firebase stack (~320+ KB of uncompressed JS) even though
only 4 landing components used `useAuth` — and only to swap a CTA button.

### 1.3 All three translations shipped in every bundle 🚨
`src/lib/translations.ts` statically imported `en.json` + `fr.json` +
`ar.json` (~136 KB raw ≈ 40+ KB gzip), and every page imported it through the
i18n providers.

### 1.4 ALL dashboard modals were in the initial dashboard bundle 🚨
`DashboardModals` statically imported 12 modals (forms, date pickers, CSV
parser, etc.) and rendered them on every dashboard page — hundreds of KB
even for users who never open a modal.

### 1.5 Slow first authenticated paint
After sign-in the app waited for a serial chain: Firebase auth restore →
**network** fetch of the profile document → Firestore month subscription
before painting anything (local month cache existed, but profile did not).

### 1.6 Other costs
- `next/font/google` fetched fonts at **build time** (builds failed on
  networks blocked from `fonts.googleapis.com`) and Google fonts were a
  third-party runtime dependency.
- Hero canvas animation ran full-DPR, ~900 points re-sorted every frame,
  even when the tab/canvas was off-screen, with no `prefers-reduced-motion`
  support.
- Static assets (`_next/static`, images, fonts) had no explicit caching
  policy for non-Vercel/CDN hosts; `robots.txt`/sitemap (rarely-changed
  files) were served with no cache headers at all.
- Dashboard page transitions were 0.30 s with no reduced-motion handling.

---

## 2. What was changed

| # | Change | File(s) |
| --- | --- | --- |
| 1 | **Static pages everywhere.** Root layout no longer reads headers/cookies and no route is `force-dynamic` — after the instant-navigation follow-up this includes `/dashboard`, `/login`, `/onboarding` (prerendered, `no-store`) | `src/app/layout.tsx`, `src/app/dashboard/layout.tsx`, `src/app/login/layout.tsx`, `src/app/onboarding/layout.tsx` |
| 2 | **Origin CSP + cache headers (all routes).** One strict origin CSP every route; private app routes stay `private, no-store`, public HTML `public, s-maxage=300, stale-while-revalidate=86400`, hashed assets 1-year immutable, `sw.js` revalidate, `robots/sitemap/manifest/llms` 1 day | `src/middleware.ts`, `next.config.mjs` |
| 3 | **Firebase scoped to app routes only.** Marketing components now use a tiny cookie-based `useAuthStatus` (no SDK). `AppProviders` (auth/household/currency/i18n/analytics) mounts only on login/onboarding/dashboard | `src/components/app-providers.tsx`, `src/lib/auth-status.ts`, `src/lib/auth-context.tsx` (sets the cookie), `hero/navigation/cta/pricing` sections |
| 4 | **Translations code-split.** Only `en.json` is bundled; `fr`/`ar` are lazy chunks loaded on demand | `src/lib/i18n-core.ts`, `src/lib/messages.ts`, `src/lib/i18n.ts`, `src/lib/i18n-light.tsx`, `src/lib/i18n-context.tsx` |
| 5 | **Dashboard modals code-split + mounted only when opened** (12 separate chunks) | `src/components/dashboard/dashboard-modals.tsx` |
| 6 | **Profile cache** — dashboard paints from the last-known profile while Firestore revalidates in the background (removes one network round-trip) | `src/lib/auth-context.tsx` |
| 7 | **Analytics loaded on first event** (`firebase/analytics` is a lazy chunk) | `src/lib/analytics.ts`, `src/lib/firebase.ts` |
| 8 | **Self-hosted fonts** — Instrument Sans via `next/font/local` (preloaded), JetBrains Mono + Cairo via `@fontsource-variable/*`. No Google Fonts at build or runtime; build now works offline | `src/app/layout.tsx`, `src/app/fonts/*`, `src/index.css`, `package.json` |
| 9 | **Canvas animations** share a hook: DPR capped at 1.5, paused off-screen via IntersectionObserver, single static frame for `prefers-reduced-motion` | `src/components/landing/use-animated-canvas.ts`, `animated-sphere/tetrahedron/wave` |
| 10 | Dashboard transition 0.30 s → 0.20 s (+ reduced-motion handling) | `src/components/dashboard/dashboard-shell.tsx` |
| 11 | Regression tests that keep the perf guardrails in place | `tests/performance.test.ts` |

---

## 2.5 Instant navigation (Instagram-style horizontal transition — follow-up)

The original investigation fixed *first load*, but clicking a dashboard nav
item was still waiting:

1. Every dashboard route was `force-dynamic`, so each click performed a
   **server round-trip** (RSC fetch) before the transition could start.
2. All dashboard nav links were `prefetch={false}` — nothing was warmed up.
3. Navigation fell through to the **global `loading.tsx` full-screen
   "Loading SmartJib..." spinner** while the fetch ran.
4. The transition itself was a slow 0.30 s crossfade.

### What changed
- **All routes (incl. `/dashboard/*`, `/login`, `/onboarding`) are now
  prerendered** — clicking a nav item is a synchronous client-side route
  change with a cached RSC payload. Zero server round-trip, zero fetch.
  Private routes keep `Cache-Control: private, no-store` (middleware).
- **All dashboard screens + profile subpages are prefetched** after idle
  (`router.prefetch` in `DashboardShell`, `DASHBOARD_NAV_HREFS`), and every
  nav `<Link>` now uses `prefetch={true}`.
- **`src/app/dashboard/loading.tsx` (also login/onboarding) renders `null`** —
  the old global spinner can never flash over the app shell again.
- **New Instagram-style push transition** in `DashboardShell`: incoming
  screen slides in from the travel direction (56px, ease-out, 220ms) on top,
  outgoing screen quickly scales to 0.975 + fades underneath (140ms) — both
  start simultaneously on click. `prefers-reduced-motion` still gets an
  instant swap.
- The per-request CSP **nonce was removed** (it is what forced dynamic
  rendering). All routes now share one strict origin-based CSP; security
  headers (`no-store` on private routes, HSTS, COOP, frame policy, etc.) are
  unchanged.

### Verified
- `next build`: `/dashboard`, `/dashboard/trends`, `/dashboard/profile/*`,
  `/login`, `/onboarding` are now **○ static**.
- Live: dashboard HTML TTFB ≈ 5–7 ms; RSC prefetch payload ≈ 8 ms (11 kB) —
  and with prefetch, the router doesn't even perform it on click.
- `/dashboard` still returns `private, no-store, max-age=0` + CSP.

---

## 3. Measured results (production build, `next build`)

### Routing — before → after
| Route | Before | After |
| --- | --- | --- |
| `/` (home) | ƒ dynamic (SSR per request) | **○ static** (prerendered, CDN-cacheable) |
| `/blog`, `/about`, `/terms`, … | ƒ dynamic | **○ static** |
| `/dashboard/*`, `/login`, `/onboarding` | ƒ dynamic (server on every nav click) | **○ static** (client-side nav; `private, no-store`) |

### Bundle — first-load JavaScript
| Route | Before (approx.) | After (measured) |
| --- | --- | --- |
| `/` home | ~550–650 kB (shared 103 + Firebase ~360 kB + 3 locale files ~136 kB + page) | **156 kB** |
| `/dashboard` | + all 12 modals in initial chunk | modals split out; `firebase/analytics` removed from initial chunk; profile cache removes a round-trip |

`next build` output (after):

```
┌ ○ /                   16.6 kB   156 kB   ← static, CDN-cacheable
├ ○ /blog               1.88 kB   141 kB
├ ƒ /dashboard         10.4 kB    372 kB   ← private, per-request only
```

### Chunk inspection (verified in `.next/static/chunks`)
- Home page references **zero** Firebase chunks (`initializeApp`/`firestore` only
  appear in dashboard chunks).
- The FR/AR translation chunk (42.6 kB raw) is **not** referenced by the home
  HTML — it loads only when a user actually needs that locale.
- Local run: `/` TTFB ≈ 5–15 ms, HTML 19 kB gzip; `/dashboard` TTFB ≈ 5–7 ms
  (prerendered). RSC prefetch payload for `/dashboard/trends`: ≈ 8 ms, 11 kB.

### Headers now served (verified with curl)
```
/                cache-control: public, max-age=0, s-maxage=300, stale-while-revalidate=86400
/dashboard       cache-control: private, no-store, max-age=0
/logo.png        cache-control: public, max-age=31536000, immutable
/_next/static/*  cache-control: public, max-age=31536000, immutable  (next.config)
/sw.js           cache-control: public, max-age=0, must-revalidate
/robots.txt      cache-control: public, max-age=86400
/manifest.json   cache-control: public, max-age=86400
```

---

## 4. How to verify / next steps

1. Deploy the branch (Vercel: `vercel` — rebuild picks up the static pages).
2. Run PageSpeed Insights on `https://<your-domain>/` (mobile).
3. Expected: TTFB drops (static HTML from CDN), JS transfer drops ~3–4×,
   fewer long tasks (no Firebase/French/Arabic hydration on the landing page).
4. If you want even more (live-page speed for repeat visits), enable the PWA
   service worker — it already caches static assets stale-while-revalidate.

### Cloudflare (optional)
The app is already Cloudflare-friendly: the middleware emits explicit
`Cache-Control` that Cloudflare cache rules honor, and the public pages are
static. To move hosting from Vercel to Cloudflare Workers, build with
[`@opennextjs/cloudflare`](https://open-next.js.org/cloudflare)
(`npx opennextjs-cloudflare build && wrangler deploy`) and set the
`NEXT_PUBLIC_FIREBASE_*` vars in the Worker environment.

> Evaluated 2026-09-09 — **not integrated, and not recommended today.**
> Every Cloudflare product overlaps something already in place: CDN/caching
> (explicit `Cache-Control` honored by Vercel's edge; authed/API responses
> are `no-store` and must not be cached by anyone), DDoS (Vercel),
> WAF/bots/rate limits (Arcjet Shield + `detectBot` on every abusable API
> route, own rate limiter, per-route Firebase-auth/`CRON_SECRET` checks;
> the two Arcjet-less routes need none — `fx` proxies keyless upstream
> APIs with allowlisted currencies and 12 h edge caching, `client-errors`
> is per-IP rate-limited with capped 204-ack payloads). Orange-clouding
> would add a second CDN hop plus SSL/purge/IP complexity for no
> measurable gain; a Workers migration is high-risk for this codebase
> (`runtime: 'nodejs'` routes, firebase-admin in the dispatcher, the
> 300 s dispatch window vs Workers CPU-time limits, Vercel Cron and
> preview env vars to rewire) with no payoff at this scale; R2/KV/D1,
> Turnstile, and extra analytics beacons have no corresponding need
> (Firestore + on-device data by privacy design, Google OAuth login,
> in-house consent-based analytics, zero third-party JS to manage).
> Revisit only to leave Vercel or for cost at scale — the IP detection
> (`x-forwarded-for`/`x-real-ip`) and cache policy already work behind
> any proxy, so no code prep is needed.

---

## 5. Trade-offs (deliberate)

- **CSP**: every page is statically generated, so a per-request nonce CSP is
  impossible. All routes share one origin-based CSP — `script-src 'self' 'unsafe-inline'`
  (all other directives stay strict: `object-src 'none'`, `frame-ancestors 'none'`,
  strict connect/frame allowlists). The strict nonce CSP was the price of
  per-request rendering; the origin CSP is the price of instant navigation.
- **Server-rendered language**: public HTML is prerendered in English; the
  language/dir switches client-side on mount (already the behaviour before for
  the message content). Public pages are cacheable for every visitor.
- **Modal exit animations**: modals now mount on open, so their exit animation
  is skipped in exchange for not shipping them to users who never open them.

---

## 6. Lighthouse `/dashboard` triage (2026-09-09)

Source: Lighthouse 13.4.1 JSON, desktop, logged-in `/dashboard`
(perf 0.74 · a11y 1.0 · best-practices 0.77 · SEO 0.66).
The run itself was contaminated (browser extensions, logged-in session,
non-incognito), so only findings reproduced in the repo were acted on.

### Fixed

- **Recharts (~372 KB) no longer prefetched from the overview.**
  `/dashboard/trends` and `/dashboard/debts` imported recharts statically,
  and both routes are prefetched from the overview nav — every overview
  visit downloaded and parsed the chart library for charts the user never
  saw (the report's 99%-unused ~495 KB chunk). `MonthTrendChart` and
  `DebtPayoffChart` are now `next/dynamic({ ssr: false })` with skeleton
  fallbacks. Both charts are aria-hidden doubles of accessible
  tables/steps, so the skeletons are a11y-neutral. Measured from the
  route manifests (marginal prefetch cost from `/dashboard`):
  trends 503 KB → 94 KB, debts 472 KB → 83 KB.
- **Favicon 179,889 B → ~800 B.** `public/favicon.svg` was an SVG shell
  around an embedded base64 512×512 PNG, fetched on every first visit
  (135 KB transfer, 2nd-largest network resource in the report).
  Replaced with a hand-drawn vector wallet in the brand teals; the
  byte-identical, unreferenced `public/icon.svg` twin was deleted.
  SW asset-cache bumped `smartjib-v7` → `smartjib-v8` (HTML cache
  untouched) so clients drop the cached 180 KB copy.
- **WCAG 2.5.3 Label in Name (4 buttons).** The money-place history
  buttons (`aria-label="View {name} history"`) and the strategy pill
  (`aria-label="Change budget strategy"`) dropped their visible
  amount/strategy name from the accessible name, so voice control could
  not target what sighted users see. Both now take their accessible name
  from contents plus an `sr-only` action note (no locale changes; screen
  readers additionally gain the previously-hidden balance). Covered by
  `tests/render/overview-labels.test.tsx`, which asserts every overview
  button's accessible name contains its visible text.
- **`productionBrowserSourceMaps: false`.** The maps were enabled for the
  `valid-source-maps` audit, but the edge answers `.map` URLs with 403,
  so the (weight-0) check fails anyway — while the files bloat deploys
  and would expose client source if they ever served. Nothing in the repo
  consumes them. Re-enable only with a private map-upload pipeline.

### Deliberately not "fixed"

- **SEO 0.66 (`is-crawlable`).** `/dashboard` is private and must stay
  `noindex` + robots-disallowed. Meaningful SEO scores come from `/`.
- **bf-cache failure.** Correct privacy trade-off: authed responses are
  `Cache-Control: no-store`, which opts out of back-forward cache.
- **Simulated LCP/TTI 10.1 s vs observed LCP 2.5 s.** The lanetlab
  simulation multiplies every prefetched byte; observed load was 2.1 s
  with 4 ms TBT and 0.003 CLS. The prefetch cuts above narrow the gap.
- **`unminified-javascript` (MetaMask), third-party cookies, gapi
  double-load (~364 KB `apis.google.com`).** Extension noise and Firebase
  Auth SDK internals (auth popup/iframe infrastructure) — no loader in
  our code (`drive-backup.ts` uses REST, tesseract is already
  `await import()`-lazy). Required for Google sign-in.
- **Remaining prefetch (~180 KB for trends+debts).** Genuine route code
  for instant tab switches — the documented navigation trade-off.
