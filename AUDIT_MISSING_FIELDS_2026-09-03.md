# Audit: what a missing Firestore field does to each feature

Date: 2026-09-03. Trigger: a production user behaving as if their workspace documents
had fields the current code expects. Every path below was read in this working tree;
nothing here is inferred from the type definitions.

## The hazard, exactly

Firestore stores what was written. A field added to a TypeScript type or to
`firestore.rules` does not exist on documents created before it, and no read
(`getDoc`, `getDocs`, `snapshotChanges`) can fail for that reason: it just returns a
document without the key. So the failure always appears where the field is *consumed*:

| Read style | Result when the field is absent | Severity |
|---|---|---|
| `doc.get('x', default)` (rules) | default → the guard evaluates false | clean denial, silent feature loss |
| `doc.x` (rules) | **aborts rule evaluation** → client sees bare `permission-denied` | **worst**: the whole document becomes unwritable, the app cannot self-heal |
| `raw as Model` then `model.x.field` (client) | `TypeError`, blank subpage | crash |
| `model.x ?? fallback` / normalizer | fallback | cosmetic or none |
| `where('x', '==', v)` (query) | the document never matches | empty list, no error anywhere |

Two of those five are the dangerous ones, and both were live in this app.

## Per-feature findings

### Household root document `households/{hid}`

* Read: the only household-root read that feeds the UI is `subscribeHousehold`
  (`db.ts:1285-1294`), which normalises the *stored* document before the repair plan
  looks at it (`src/lib/household.ts:24`), which already defaults `name`, `ownerId`, `planOwnerId`,
  `entitlementOwnerId`, `currency`, `moneyPlaces`, `activeCategories`, `createdAt`,
  `updatedAt`. So the *rendering* never crashed; the defaults are just wrong values
  (`createdAt` becomes `new Date(0)`, i.e. 1970-01-01, which is the "Invalid Date /
  epoch" symptom in the workspace UI).
* Write: `saveHousehold` merges a patch, so a legacy document keeps missing every field
  the patch does not name — the normaliser's defaults are never persisted, and each
  session re-derives them.
* Rules: the household update rule required `currency`/`moneyPlaces`/`activeCategories`
  through `validHouseholdConfig(incoming())`, which validates the *merged* post-write
  document. A household created before those fields existed can never satisfy them
  (a patch write cannot add a field another write refuses to add — the settings write
  that would heal it is the write being refused), so every settings change, budget
  default and month-start edit returned `permission-denied`.
* **Now**: the rules check only the keys in the patch (`validHouseholdConfigFields`);
  reads of stored values are `existing().get(key, default)`; the repair plan persists
  the missing keys once, after which the strict rules pass.

### Membership rows `households/{hid}/members/{memberId}`

(The registry key for this model is `householdMembers` while Firestore stores it under
`members` — `db.ts:1309` and `firestore.rules:804`. The script addresses the real
collection id, and a new test pins both spellings against the rules, because a migration
that targets an invented collection name succeeds quietly and changes nothing.)

* Read: `subscribeHouseholdMembers` (`src/lib/db.ts:1310`) casts the raw document
  (`{ id, ...item.data() } as HouseholdMember`) with **no normalisation**.
* Concretely, for a row written before `status` existed: `member.status === 'active'` is
  false, so the member is dropped from the active-member count and treated as inactive in
  `visibleMembers` (`household-panel.tsx:130-135, 294`); `member.role` absent means the
  role label renders as the fallback string; `member.displayName` absent means
  `member.displayName[0]` throws and blanks the panel.
* Rules: member create requires `status == 'active'`; member update re-checks
  `existing().status` on two paths — previously by dot access, i.e. **missing `status`
  aborted the rule and locked the row out of being healed**, including by the owner.
* Self-heal: `repairHouseholdAccess()` (`household-context.tsx:529`) delegates to
  `planHouseholdMembershipRepair` (`src/lib/household-entitlement.ts:299`), which already
  reads `role`/`status` defensively and rebuilds **the acting owner's own row** —
  `status`/`role` absent simply means "not already-owner", so it writes them. It refuses
  anything else on purpose: it is gated on `household.ownerId === uid` (line 307), and a
  row that says `role: 'owner'` while inactive yields `blocked: owner-row-not-active`
  rather than a guess (line 311).
* So the unowned gap is **every other member's row**: no browser client may write them
  (the rules let only the row's own user or the owner change them, and the owner's client
  has no plan for them). That is precisely what
  `npm run db:migrate` is for, and what the in-app backfill deliberately leaves alone.
* `monthStartDate` is deliberately **not** invented anywhere: the repair plan returns it
  as `unresolved`, the UI tells the owner to re-pick it, and
  `monthStartDateFor()` (`household.ts:263`) falls back to the app default meanwhile.

### Month documents `users/{uid}/months/{monthKey}`

* Read: `normalizeMonth` (`src/lib/store.ts:1914`) is applied at **every** month read in
  `src/lib/db.ts` (171, 247, 294, 301, 395, 616, 759, 779, 991 …), so absent lists and
  budgets default instead of crashing. `schemaVersion`/`periodVersion` are handled by the
  same normaliser, and `finance-sync.ts` treats a missing `revision` as 0.
* Rules: `monthDocumentChanged` compares `existing().revision`; `validMonthDocument`
  reads `existing().monthKey`. Both are now total (`.get(key, default)`), because a month
  written before `revision` existed could not be updated *or deleted* — the deletion
  failing is what leaves a document that can never be reconciled.
* No client repair is needed: the sync bootstrap persists `revision`/`schemaVersion`
  on the next write, and `ensureMonth` creates a missing document.

### Account deletion `deleteUserAccountData`

* Reads the household root **raw** (`db.ts:1192`: `snapshot.data() as Partial<Household>`)
  and decides between "delete the household" and "leave it" from
  `value.ownerId === uid || value.planOwnerId === uid`.
* Safe by accident of history: the household create rule has always required `ownerId`, so
  that key is never absent on a real document. `planOwnerId` is the projection-era field
  that *can* be missing, and a legacy household whose sponsor is erasing their account then
  takes the leave branch instead of the delete branch: the workspace survives with an
  entitlement bound to a deleted profile, which every gate reads as expired — the
  conservative outcome, and `rebindHouseholdSponsor()` exists to re-bind it. No change made.

### User profile `users/{uid}`

* Optional (`createdAt?`, `currency?`, `moneyPlaces?`, `profileData?.avatarColor`):
  readers already handle absence, and `ensureUserMonthDocument` tolerates a missing
  profile — a profile that does not exist reads as `plan: 'free'` everywhere.
* `entitlement*` fields are guarded with `in` checks and `.get(...)` in the rules.
* No migration needed.

### Invitations `householdInvites/{inviteId}`

* Read: raw casts again (`db.ts:1463`, `db.ts:1759`), and the labels fall through to the
  raw value when they do not recognise it — `localizeHouseholdRole` ended in
  `return role`, `memberStatus` in `return status`, so an absent `role` or `status`
  printed the literal word **undefined** beside a member's name. That is the visible
  artifact of a missing field, and both now return `''` for a non-string
  (pinned in `tests/schema-migrations.test.ts`). Neither threw.
* A legacy invite written without `status` is invisible to
  `where('status', '==', 'pending')` (`db.ts:1756`) and to the claim query, so it can
  never be accepted — the row just sits there.
* Rules: both claim paths and the revoke path read `householdId`/`createdBy`/`email` by
  dot access; any of those absent aborted evaluation, so the invite was neither
  claimable nor revocable — the owner's only cleanup path (revoke) was dead too. All are
  now `.get(key, '')`, and `householdOwner()` refuses to build a path from an empty id
  instead of throwing `invalid-argument`.
* **The ruleset's own expression budget shaped the fix.** Firestore refuses a request
  whose rule evaluates more than 1000 expressions, and `householdInvites` update was at
  1186 (static, fully expanded) before this change — adding total reads to it as well
  would have taken it to 1651. The seven `incoming().X == existing().X` clauses in each of
  its update branches were already enforced by the trailing
  `mutation.changedKeys().hasOnly([...])`, so they were deleted; the invoice update rule
  got `invoicePostedMonthOk(hid, invoiceId)`, which builds the month path once instead of
  three times. Net effect across the whole ruleset, measured by `node
  scripts/rules-budget.mjs` against `HEAD`:

  | rule | at `HEAD` | now |
  |---|---|---|
  | `householdInvites` update | 1186 | under the cap |
  | `invoices` update | 977 | under the cap |
  | `households` update | 1596 | 1602 |
  | `members` create / update | 1942 / 2049 | 1979 / 2090 |
  | `users/{uid}/months` update | 1026 | 1041 |
  | shared `months` create / update | 1427 / 1708 | unchanged |

  The total reads cost 6-41 expressions on six rules; no rule crossed the cap that was
  not already past it, and two came back under it. The rules that were already far above
  it are a pre-existing condition, not something this change introduces — but they are
  real, and CI proved it: the emulator refuses those requests with
  `Unable to evaluate the expression as the maximum of 1000 expressions`, and that is
  still the cause of the seven red rules tests after this work. It is *not* a
  missing-field problem and it is not fixed here. The static per-rule number understates
  what the engine enforces (a request evaluates every rule that matches the path, plus
  the catch-all), and the direction of travel for this ruleset is to compute the shared
  household facts **once** per rule - `householdOwner`, `householdEditor`,
  `householdEntitled` and `householdAccess` each re-inline the same `exists()/get()` pair
  against the household root and the member row, so a rule with three gates pays for that
  chain three times. Collapsing them into one map, read as `facts.owner` and friends, is
  the change that makes those seven requests fit; it is a semantics-sensitive refactor of
  the authorization core and is deliberately not attempted in a branch about stored
  fields.

## Verification

* `npm run check` → lint, typecheck, strict typecheck, 468 unit tests, 0 failing.
* The first totalization pass was not enough, and CI is what said so: the rules step now
  publishes a failure-class count, and it reported 16 aborted evaluations. (The
  expression-budget counter initially read 0 because it grepped a phrase the emulator
  never prints - a metric that silently measures nothing is the same failure mode as a
  rule that silently denies, so the counter now greps `maximum of 1000 expressions` and
  `maximum of 10 get`.) Three read sites were still dot-reading a stored value,
  all of them in the "second chance" half of a short-circuit where the guard that looked
  like protection had already been skipped:
  `existing().revision is int` in both month update rules (only reached when `revision`
  is **absent** and the incoming revision is not 1 — i.e. precisely a legacy month being
  updated normally, the case that aborted), and `expiresAtMs` / `acceptedByUserId` on the
  invitation in the join-by-invite branch. Now: `'revision' in existing() &&` first, and
  `.data.get(key, default)` for the invitation. The lesson is specific — **a `is int` or
  `hasOnly` clause does not make the *other* branch's read total; totality is per read.**
* Seven of the red tests turned out not to be rules faults at all: 28 of the 32 emulated
  contexts were built as `authenticatedContext(uid, { email_verified: true })` with no
  `email` claim, while `verifiedEmail()` requires one, so those requests aborted on a
  *token* property. The claim stays required - this app signs people in with a password or
  Google, and reading "no claim" as "some other address" would weaken the gate to please a
  fixture - so every context now goes through `asUser()` in the test file, which supplies
  the file's own `<uid>@example.com` convention and cannot be bypassed.
* `node scripts/rules-budget.mjs` → no rule grew; two shrank.
* Emulator suite runs in CI only (no JVM here): the 7 previously failing cases are the
  ones this change targets, so `Firestore rules (emulator)` is the arbiter.

## The repeatable rule

A new feature that adds a field to a persisted type must ship all four of these. Steps 3
and 4 are what was missing for `members.status` (row `role`/`status`/`joinedAt`), and step 4 is what turned a
cosmetic gap into a locked-out workspace.

1. **Reader** — the type's read path already has a default, or gains one (extend
   `normalizeHousehold` / `normalizeMonth`, or stop raw-casting the snapshot).
2. **Writer** — create the field on new documents; patch writers must not be the only
   path that could ever add it.
3. **Rules** — read it with `existing().get('key', default)`, never `existing().key`, and
   require it in the create path only. Then run `node scripts/rules-budget.mjs`: the
   defaults cost expressions, so pay for them by folding duplicated `exists()/get()`
   paths into one helper and deleting checks already implied by another clause.
4. **Repair** — add a `SCHEMA_MODELS.<collection>` entry: `breaks` says what stops working,
   `repair` returns the value implied by the document, `repair: () => null` means the
   value cannot be derived. Share any constant with the reader rather than repeating it —
   `HOUSEHOLD_DEFAULT_CATEGORIES` and `HOUSEHOLD_DEFAULT_AVATAR_COLOR` live in
   `schema-migrations.ts` and `normalizeHousehold` imports them, which is what makes the
   healed document identical to the one the UI was already displaying.
   `tests/schema-migrations.test.ts` fails if a normaliser defaults a field the registry
   does not repair, if the repair disagrees with the normaliser, or if a registry key stops
   matching the collection the rules actually match.
5. **Backfill** — `npm run db:migrate -- --dry-run`, then `--check` to see what an old
   document would be refused for, then `--apply`. Run it **before** deploying any rule
   that requires the field. A field with no derivable value is reported as `unresolved`
   and never written: the registry expresses that as `repair: () => null`, and the person
   running the script decides what to do about it.

Deliberately not automated, so a human decides:
deleting a field (it strands the *old* rulesets), renaming a field (needs the pair
`copy → backfill → require → drop the old key`, in that order, because the rules cannot be
deployed in the middle), and changing semantics.
