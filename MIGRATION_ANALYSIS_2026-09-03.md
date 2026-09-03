# Backend architecture: keep Firestore, or move to Prisma + Supabase?

Written 2026-09-03 against `arena/01a06714-flousy-app` (`f1871ed`). Numbers are measured from this tree, not recalled: every count below came from `grep`/`wc` over the checkout, so re-run them if the tree moves.

## Verdict

**Do not migrate for the reason you are probably considering it.** The pain of the last days — `permission-denied` on writes that should be allowed, an expression budget that had to be measured with a bespoke script, rules that can only be evaluated in CI — is not Firestore-the-database being wrong for this app. It is **business logic living in security rules**, which is a choice this architecture has been drifting into for a while and which costs the same or more in Postgres if you re-create it there as RLS policies over fat documents.

Ranked by value per day of work:

1. **Keep Firestore. Move the multi-document invariants out of `firestore.rules` and into the server layer you already have** (Next.js route handlers + `firebase-admin`). Rules shrink from policy-plus-domain-model to a membership check. This is 2–4 days, it is reversible, and it removes the class of bug that produced the sync failure, the ledger `kind` denials and the 1000-expression cap.
2. **Migrate to Supabase (Postgres) when you next need something relational** — cross-month reporting, a real debts/transfers ledger, unique constraints you can rely on, or billing you can predict. Then use **supabase-js + RLS from the client** (same trust model as today) and keep **Firebase Auth as the identity provider** via a custom JWT provider.
3. **Prisma is not a backend, and it is the wrong layer for this app's current shape.** Prisma is server-side by construction, and a Prisma client connecting as Supabase's `postgres` role **bypasses RLS** — so "Prisma + Supabase" means you also commit to (a) a real API layer and (b) authorization in application code. That is a fine architecture, but it is a rewrite of the data tier plus a rewrite of the trust model. Do it only if you want both.

If you want one sentence to act on: fix the rules by *removing* logic from them, not by outsmarting a 1000-expression budget; keep Postgres in mind as the next platform when reporting and integrity constraints, not policy expressiveness, become the bottleneck.

## What this app actually asks of a backend (measured)

| Surface | Measured | Read |
| --- | --- | --- |
| Files importing the Firebase SDK | **4** (`src/lib/firebase.ts`, `db.ts`, `auth-context.tsx`, `analytics.ts`) | The seam is real and small. A migration touches these plus 8 component files that import `db.ts`. |
| Public data API | `src/lib/db.ts`: 1685 lines, **58 exports** | One module owns every read and write. |
| Realtime | **11** `onSnapshot`, 0 `orderBy`, **1** composite index | No query-heavy surface; almost everything is a document get or a whole-collection list. |
| Atomicity | **7** `runTransaction`, 4 `writeBatch` | Concurrency lives in `commitFinanceMutation`, keyed on a mutation ledger row. |
| Server-side code | **4** Next route handlers (barcode lookup, contact, household invitations, client-errors), `src/lib/server/{arcjet,rate-limit,telemetry}.ts` | There is already a trusted server tier — it just does not enforce anything about money. |
| Cloud Functions | none (`functions/` does not exist, no `firebase-functions` dep) | Nothing is pinned to Firebase's compute product. |
| Storage | no `getStorage`/`uploadBytes` anywhere; no `storage.rules` | Receipts are base64 strings inside documents (rules allow ≤120 000 chars). |
| Offline | **no `initializeFirestore(..., persistentLocalCache)`** — `firebase.ts` calls plain `getFirestore(app)` | Firestore's headline offline cache is *not in use*. The app hand-rolls its own: `finance-sync.ts` (381 lines: IndexedDB outbox `flousy-finance-outbox`, per-month conflict queueing, three-way merge, `FinanceConflictError`) plus `month-cache.ts` (localStorage). |
| Auth | email/password, Google popup + redirect, `sendPasswordResetEmail`, email-verified gate in rules, server-side ID-token verification in `firebase-id-token.ts` | Portable; the only deep coupling is `token.email` inside rules. |
| Derived math | `store.ts`: 2458 lines, 85 functions | The engine is TypeScript, run client-side — not the database. |

The important row is "Offline": the single strongest argument for Firestore — a synced local cache for free — is not what this app uses. It has its own outbox and its own merge, so it is already carrying the hard part of an offline-first app itself. Staying on Firestore is not buying that feature; it is keeping a database whose rules language the app has begun to use as a virtual machine.

## Why the rules hurt: the two budgets, in the same file

`firestore.rules`: **1032 lines, 56 `allow` rules, 62 helper functions, 137 inline type/cardinality assertions, 135 `get()`/`getAfter()`/`exists()` call sites.** Roughly 310 lines of helpers decide *who* may write, ~140 decide *whether the data is legal* — plus per-collection rule bodies that re-check the legality of the same document shapes the client already validated in `store.ts`.

Firestore gives you two hard ceilings, and both are per **request**, not per rule:

| Limit | Value | Consequence here |
| --- | --- | --- |
| Document access calls (`exists`/`get`/`getAfter`) | **10** for a single-document write, **20** for a batched write / transaction | An outbox flush writes ledger row + month + savings (+ invoice). `householdAccess` alone costs root + member + sponsor profile per matched rule; `mutationLedger` adds one. Three documents × ~4–5 accesses is already ~⅔ of the request budget, and cached repeats of the same path are the only relief. |
| Expressions evaluated | **1000** per request | The month-update rule is one inlined `monthUpdateAuthorized()`. It is why `scripts/rules-budget.mjs` exists and why the estimator now prints into CI's step summary. |
| Failure mode of both | denial, not error | Exceeding either limit, or any evaluation error (a missing property, a `.data` on a missing document), reaches the client as `permission-denied`. There is no diagnostic. |

That last row is the entire origin of this session's bug. Note the trap it creates: **every existence guard you add to stop an evaluation error consumes the access-call budget**, and every budget saving you make tempts you to skip a guard. Correctness and feasibility trade against each other inside the file. `householdAccess` returning a map, path helpers bound with `let`, `monthUpdateAuthorized` folding the whole update rule into one call — that was all this trade being paid for, and there is no version of adding more rules-domain logic here that does not pay again.

For comparison, in Postgres an equivalent policy is a SQL expression evaluated per row against an index, `EXPLAIN`-able, and with no documented per-request expression ceiling; and the *validation* half of the rules file mostly evaporates into types and constraints (below).

## What Postgres would give you for free

Everything in this table is something this repo currently hand-simulates, in TypeScript and in rules:

| Hand-simulated today | Postgres equivalent |
| --- | --- |
| Mutation ledger row, `mutationId == mutationId`, `mutationTargetAgrees`, "a replay is idempotent because the target already carries the mutation key" | `mutation_ledger` PK `(workspace_kind, workspace_id, mutation_id)` + `INSERT … ON CONFLICT DO NOTHING`; the "already applied" answer is the insert's row count |
| `nextRevision == baseRevision + 1`, `validRevisionBump()`, revision-1 bootstrap special cases | `UPDATE month_budgets SET … WHERE id = $1 AND revision = $2` — optimistic concurrency as a predicate; row locks replace the transaction's read-modify-write |
| `incoming().lastMutationId.size() <= 160`, `barcode.matches('^[0-9]{8}$') or ^[0-9]{13}$` | `CHECK (lastMutationId ~ '^[0-9]{8,13}$')`, `CHECK (barcode ~ …)`; product barcode as PRIMARY KEY |
| Cardinality caps (`variableExpenses ≤ 2000`, `fixedExpenses ≤ 500`, `goals ≤ 200`) | `CHECK (jsonb_array_length(data->'variableExpenses') <= 2000)`, or child tables where those caps stop being a workaround for the 1 MiB document limit |
| `deleteUserAccountData`: 90 lines of per-collection `getDocs`+`deleteDoc` loops, ordered by hand so orphans do not survive | `ON DELETE CASCADE` + a `DeletionReport` from a few `DELETE … RETURNING count(*)` |
| `isProPlanValue` / `profileIsPro` / `millisOrMissing` / `entitlementProjectionAgrees` / `householdSponsor` (the sponsor fallback chain, mirrored again in `household-entitlement.ts`) | one `STABLE` SQL function + a generated column; the client mirror stays only for UI latency |
| `customMonthChangesGranted(permissions)` — per-area `affectedKeys().hasOnly(…)` whitelist of ~24 keys | column-level `GRANT UPDATE (col, col, …)` or a policy over the specific columns; no whitelist to keep in sync with `household-rbac.ts` |
| `monthStartDate`/currency agreement between workspaces, month-key format | `CHECK` + FK; `month_key date NOT NULL` instead of `'YYYY-MM'` strings validated by regex in two languages |
| Trends screen: `listMonths` then 6 parallel `getDoc`s with a localStorage fallback | `SELECT … ORDER BY month_key DESC LIMIT 6`, one round trip |
| Receipts as ≤120 000-char base64 in the document | Supabase Storage object + a path column (also fixes the 1 MiB pressure) |

The two Firestore-specific ceilings disappear with it, which is the point: `EXPLAIN` replaces a bespoke estimator script, and there is nothing like the access-call budget to plan around.

## What you would lose, and how much it actually costs you

1. **Realtime, with caveats.** Supabase Realtime's DB changes come from logical replication: 256 KB per message, and `UPDATE` payloads need `REPLICA IDENTITY FULL` to carry old values, with all rows of a table delivered to every subscriber unless you filter per connection. Your largest month documents (approaching the 2000-entry cap ≈ hundreds of KB of JSON) could exceed the message size — which is an argument for child tables if you migrate, and an argument that today's Firestore listeners ("send me this one document") are genuinely better for *this* access pattern. Realistic free/Pro ceilings also matter early: 200 peak concurrent realtime connections on Supabase's free tier, 500 on Pro.
2. **Cost shape.** Firestore bills per operation: 50 000 reads / 20 000 writes / 20 000 deletes per day free, 1 GiB stored, then pay-as-you-go. Note that **reads consumed by rule evaluation are still document reads** — a `householdAccess`-heavy write path is burning billing headroom on policy. Supabase bills per project: free tier 500 MB database with projects pausing after 7 days idle, Pro $25/month with 8 GB and daily backups. Predictable, cheaper at any real listener fan-out, but a paused project must never be your only copy of a user's budget.
3. **You keep everything you built for offline.** Nothing in `finance-sync.ts` is Firestore-specific except `runTransaction` and the refs; a Postgres commit is *simpler* than the current protocol (one UPDATE with a revision predicate instead of a three-document transaction read).
4. **Auth does not have to move.** Supabase accepts custom JWT providers, so Firebase can keep issuing ID tokens while the database becomes Postgres. Importing Firebase password hashes into Supabase Auth is not a clean path (Firebase uses its own scrypt format), so "auth in the same move" is the riskiest single step of a full migration; decoupling it is what makes option 2 below tractable.
5. **Ops you do not have today.** No pooling to think about if the client stays direct (PostgREST over HTTPS). The moment Prisma or route handlers touch Postgres on Vercel, you need the Supabase **pooler** for queries and the **direct connection** for `migrate`/DDL (`?pgbouncer=true` + `directUrl`), or you will exhaust connections.

## The three architectures, priced

| Option | What changes | Effort | Fixes the bug class? | Buys the relational model? |
| --- | --- | --- | --- | --- |
| **A. Firestore + thin enforcement API** (recommended now) | Move period close/reopen, invoice approval, invite acceptance, sponsor rebinding, account deletion, backup restore into route handlers using `firebase-admin` (service account, bypasses rules). Rules keep only: signed in, membership/ownership, workspace id match, document *shape* sanity. `commitFinanceMutation` keeps its transaction for the hot path; the ledger row becomes a claim on the server. | **2–4 days** | **Yes** — logic stops living under a 1000-expression budget | No |
| **B. Supabase Postgres + RLS, client-direct, Firebase Auth via custom JWT** | Schema + policies for the ~10 collection groups; rewrite `db.ts`'s 58 exports against supabase-js; move realtime to `postgres_changes`; data load through the existing `FinanceBackup` format (already a validated, tolerant, versioned full-workspace dump with a plan/notice layer — it is a migration loader with a new sink). | **1.5–3 weeks** | Yes, and it deletes the duplicated validation | **Yes** |
| **C. B + a real server layer with Prisma** | As B, plus typed schema/migrations and all access through an API. Prisma needs pooler/direct URLs, and RLS must be enforced by *your* code because Prisma's `postgres` role bypasses it. | **+3–5 days over B** | Yes | Yes, and you own the trust model explicitly |

Option A is the one that is worth doing regardless of where you end up, because it is the one that keeps *both* other options open: once the invariants live in a server tier, moving Firestore → Postgres is swapping a sink in ~1500 lines of one file and the rules file simply stops existing, instead of being translated line-by-line into 1000 lines of policy you also have to test.

## Migrate anyway when any of these is true

- You ship cross-period reporting, exports, or per-member analytics that need joins/aggregations (today: N document reads and 2458 lines of client-side `store.ts`).
- You need an invariant Firestore cannot express: uniqueness across documents, `NOT NULL`/FK integrity, or "this total must equal the sum of those rows" as a constraint rather than a convention.
- Your bill is dominated by reads caused by policy evaluation or listener fan-out, rather than by users doing things.
- You want the same money math on the server (CSV/report generation, webhooks from a payment provider, a Stripe/CMI integration that must post into a month atomically). That last one is decisive: as soon as a *payment provider* has to move money state, a client-only rules-enforced model is the wrong shape and you will need Postgres or a Cloud Function.
- You need point-in-time recovery / `pg_dump`-style backup as a compliance answer (Firebase has scheduled exports, but PITR is a Supabase plan feature).

Do **not** migrate because of: realtime (Firestore is better for your per-document subscription pattern), offline (you already hand-rolled it; a DB swap changes nothing), developer experience in *this* sandbox (there is no JVM here and `storage.googleapis.com` is blocked, so the Firestore emulator can only run in CI — but there is also no `psql` or Docker here, so Postgres is not testable here either; the DX win is on a normal machine and in CI, where Postgres is a service container and the whole 22-case emulator suite becomes SQL assertions you can run in a second).

## If you do B: the shape to aim at

```
workspace       (id, kind in ('personal','household'), owner_id, currency, month_start_date int,
                 entitlement_owner_id, entitlement_ends_at_ms bigint, ...)
member          (workspace_id, user_id, role, status, permissions jsonb,
                 primary key (workspace_id, user_id))
month_budget    (id, workspace_id, month_key date, revision int not null default 1,
                 period_status, closed_at, closed_by, data jsonb,
                 unique (workspace_id, month_key),
                 check (jsonb_array_length(coalesce(data->'variableExpenses','[]')) <= 2000))
mutation_ledger (workspace_id, mutation_id, actor_id, kind, month_key,
                 base_revision, next_revision, created_at,
                 primary key (workspace_id, mutation_id))
invoice         (id, workspace_id, submitter_id, status, amount numeric(12,2),
                 reviewed_by, posted_expense_id, posted_month_key, receipt_path)
invite          (id, workspace_id, email, role, status, expires_at,
                 unique (workspace_id, email) where status = 'pending')
```

- Entries stay inside `month_budget.data` **as long as** the aggregate is edited and merged as a unit — that is exactly your current semantics, and it keeps `commitFinanceMutation`'s three-way merge honest. Split `variableExpenses`/`debts`/`transfers` into child tables when you need to query *them*, not before; splitting early is what turns a 2-week migration into a 6-week one because every screen changes.
- One `can_write_month(workspace_id, user_id)` `STABLE` function + a `security invoker` view for membership-and-entitlement: RLS policies reference it, so the "who pays for this workspace" question is computed in one place, indexed, and profiled with `EXPLAIN` instead of estimated by a script.
- The revision bump and the idempotency claim go in one trigger or one RPC (`commit_month_mutation(...)`), so the *client* stops being the only place that knows the protocol.
- Keep `firestore.rules` (or its absence) honest in CI the same way #48 does now: a step that runs the policy suite and prints a summary.

## Sources for the platform claims above

- Firestore quotas/limits — access-call budget (10 / 20), 1000 expressions/request, 7 args, 10 `let`s, function depth 20, ruleset 256 KB / 250 KB: https://firebase.google.com/docs/firestore/quotas (and https://docs.cloud.google.com/firestore/quotas)
- Firestore free tier (1 GiB, 50k reads, 20k writes, 20k deletes/day, 10 GiB egress): https://cloud.google.com/firestore/quotas
- Supabase tiers (free: 2 projects, 500 MB DB, 200 concurrent realtime connections, 2 M messages, pause after 7 days idle; Pro $25: 8 GB DB, 100 GB storage, 500 connections, daily backups): https://www.cloudzero.com/blog/supabase-pricing/ , https://aiagencyplus.com/supabase-free-tier-limits/
- Prisma with Supabase: pooled URL for queries with `?pgbouncer=true`, `directUrl` for migrations, and Prisma Client's `postgres` role bypassing RLS (use supabase-js for RLS-protected access): https://www.rapidevelopers.com/supabase-tutorial/how-to-use-supabase-with-prisma , https://github.com/prisma/prisma/discussions/29368
- Rules language semantics used throughout `firestore.rules` (`String.lower/trim/matches`, `Map.get(key, default)`, single-`return` function bodies, RE2): https://firebase.google.com/docs/reference/rules/rules.String , https://firebase.google.com/docs/rules/rules-language
