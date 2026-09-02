# Browser E2E (Playwright)

These tests cannot run in the development sandbox (the Playwright browser CDN
is blocked there); they are meant for CI or a release machine.

## Running

```bash
npx playwright install chromium --with-deps   # once per machine
npm run test:e2e
```

The config builds the app and serves it on port 3100 by itself.

## Environment

Run **without** `NEXT_PUBLIC_FIREBASE_*` variables. The app then treats itself
as unconfigured and `/login` offers **demo mode**, which the journeys use —
no Firebase project, no service account, no network dependency.

Likewise leave `RESEND_API_KEY` unset: the contact spec asserts the truthful
"not configured" fallback rather than sending real mail.

## What is covered

- `landing.spec.ts` — home page renders, skip link is first focusable,
  static pages (help/contact/privacy/terms) respond, llms.txt/pricing copy
  advertises the 90-day trial (not stale beta wording).
- `i18n.spec.ts` — locale switch to French and Arabic, `dir="rtl"` flips.
- `contact.spec.ts` — form validation and the honest not-configured fallback
  that names the support address.
- `demo-journey.spec.ts` — demo mode entry from /login and arrival in
  onboarding, plus a returning-session redirect to the dashboard.
