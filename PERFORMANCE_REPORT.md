# Performance Investigation & Fixes — SmartJib / Flousy

Date: 2026-08-30 · Branch: `arena/01a0504b-flousy-app`

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
| 1 | **Static public pages.** Root layout no longer reads headers/cookies and is no longer `force-dynamic`; language is resolved client-side. Private routes (`/dashboard`, `/login`, `/onboarding`) keep `force-dynamic` | `src/app/layout.tsx`, `src/app/dashboard/layout.tsx`, `src/app/login/layout.tsx`, `src/app/onboarding/layout.tsx` |
| 2 | **Two-tier CSP + cache headers.** Private routes keep the strict per-request nonce CSP (`strict-dynamic`, `private, no-store`). Public static pages get a strict origin CSP (`script-src 'self' 'unsafe-inline'`, everything else locked down) plus `public, s-maxage=300, stale-while-revalidate=86400`. Hashed assets → 1-year immutable; `sw.js` → revalidate; `robots/sitemap/manifest/llms` → 1 day | `src/middleware.ts`, `next.config.mjs` |
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

## 3. Measured results (production build, `next build`)

### Routing — before → after
| Route | Before | After |
| --- | --- | --- |
| `/` (home) | ƒ dynamic (SSR per request) | **○ static** (prerendered, CDN-cacheable) |
| `/blog`, `/about`, `/terms`, … | ƒ dynamic | **○ static** |
| `/dashboard/*` | ƒ dynamic | ƒ dynamic (intentional — private, `no-store`, per-request nonce CSP) |

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
- Local run: `/` TTFB ≈ 5–15 ms, HTML 19 kB gzip; nonce header == inline
  `nonce=` attributes on `/dashboard`, `/login`, `/onboarding` (single-response
  check).

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
`NEXT_PUBLIC_FIREBASE_*` vars in the Worker environment. No code changes
required; the private-route CSP nonce middleware runs as a Worker as-is.

---

## 5. Trade-offs (deliberate)

- **Public CSP**: static HTML can't carry a per-request nonce, so public pages
  use `script-src 'self' 'unsafe-inline'` (all other directives stay strict:
  `object-src 'none'`, `frame-ancestors 'none'`, strict connect/frame
  allowlists). Private authenticated routes keep the strongest per-request
  nonce CSP — that's where user data lives.
- **Server-rendered language**: public HTML is prerendered in English; the
  language/dir switches client-side on mount (already the behaviour before for
  the message content). Public pages are cacheable for every visitor.
- **Modal exit animations**: modals now mount on open, so their exit animation
  is skipped in exchange for not shipping them to users who never open them.
