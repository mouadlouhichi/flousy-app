# Packages

Shared libraries used by `apps/web` and (where the runtime allows) `apps/mobile`.
Pattern taken from next-forge: **one package per integration**, source-only,
typed `package.json` exports. Vendors that fight Firebase + Expo stay out.

| Package | Use | Do not put here |
| --- | --- | --- |
| `@flousy/core` | Money math, household RBAC, i18n catalogs, Pro feature flags | React, Firebase SDK |
| `@flousy/email` | Resend client, invite HTML/text, env probe | Auth / Firestore reads |
| `@flousy/payments` | Pro pricing + checkout (mock until Stripe is live) | UI modals |
| `@flousy/observability` | `captureException` / `captureMessage` | Sentry SDK until we add it on both web and Expo |
| `@flousy/rate-limit` | Per-isolate sliding window | Upstash until we need a distributed cap |
| `@flousy/next-config` | Security headers, `transpilePackages` | PostHog / Clerk image hosts |
| `@flousy/typescript-config` | Shared `tsconfig` for packages | Expo's tsconfig |

## Intentionally not extracted

- **Auth / database** — Firebase Web SDK vs React Native Firebase. Keep clients in each app.
- **UI** — shadcn/Radix cannot run on native.
- **Analytics** — opt-in Firebase Analytics already lives in the web app.
- **i18n runtime** — catalogs are in `core`; next-international / i18next stay in apps.

## Adding a package

1. `packages/<name>/package.json` with `"name": "@flousy/<name>"` and `workspace:*` consumers.
2. Source-only (`main` / `exports` point at `src/index.ts`). `build` is a no-op like `core`.
3. Add it to `FLOUSY_PACKAGES` in `packages/next-config/index.mjs` so Next transpiles it.
4. `pnpm install` so the lockfile lists the new importer (EAS uses `--frozen-lockfile`).
