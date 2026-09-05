import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildHouseholdSponsorBinding,
  diagnoseHouseholdWriteDenial,
  householdSponsorBindingIsStale,
  householdSponsorId,
  householdSponsorProjectionFields,
  planHouseholdMembershipRepair,
  type HouseholdMembershipRepairInput,
} from '../src/lib/household-entitlement';
import { entitlementToken, resolveProEntitlement } from '../src/lib/pro-features';

/**
 * `firestore.rules` decides every shared-workspace write from the sponsor's
 * profile, and `src/lib/household-entitlement.ts` decides which refusal message
 * and which repair the app offers. The two must agree token for token: when
 * they don't, a user with a plainly active plan watches their edits queue and
 * fail forever. These tests pin the client half and the rules text itself,
 * because a rule that aborts (a missing property, a deleted profile) is
 * indistinguishable from a denial on the client.
 */

const rulesSource = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 3);

describe('household plan sponsor resolution', () => {
  it('follows the same fallback chain as normalizeHousehold() and householdSponsor()', () => {
    assert.equal(householdSponsorId({ entitlementOwnerId: 'a', planOwnerId: 'b', ownerId: 'c' }), 'a');
    assert.equal(householdSponsorId({ planOwnerId: 'b', ownerId: 'c' }), 'b');
    assert.equal(householdSponsorId({ ownerId: 'c' }), 'c');
    assert.equal(householdSponsorId({}), '');
    assert.equal(householdSponsorId(null), '');
  });

  it('never reads a household field directly in the rules', () => {
    // A document written before `entitlementOwnerId` existed used to abort
    // rule evaluation for every member of the workspace.
    const sponsorLookup = rulesSource.slice(
      rulesSource.indexOf('function householdSponsor('),
      rulesSource.indexOf('function householdEntitled('),
    );
    assert.deepEqual(
      [...sponsorLookup.matchAll(/data\.get\('(\w+)', ''\)/g)].map((match) => match[1]),
      ['entitlementOwnerId', 'planOwnerId', 'ownerId'],
    );
    assert.doesNotMatch(sponsorLookup, /\.data\.\w+/);
    // Only `get(key, default)` reads survive on a household document - a bare
    // property access aborts the request for every member of the workspace.
    assert.doesNotMatch(rulesSource, /hous\w*Path\(hid\)\)\.data\.(?!get\()/);
    // Reading a sponsor's profile goes through `userProfileData()`, which answers
    // with an empty map for a deleted account instead of aborting.
    assert.doesNotMatch(rulesSource, /documents\/users\/\$\(uid\)\)\.data\.(?!\s*$)/m);
  });
});

describe('household sponsor binding', () => {
  it('binds a console-provisioned plan with an unbounded status the rules accept', () => {
    const binding = buildHouseholdSponsorBinding({ plan: 'pro' }, 'owner-uid', now);
    assert.equal(binding.bindable, true);
    assert.deepEqual(binding.patch, {
      entitlementOwnerId: 'owner-uid',
      entitlementSource: null,
      // The rules demand the profile's own status; there is none, so the
      // derived 'active' is what `entitlementProjectionAgrees()` licenses.
      entitlementStatus: 'active',
      entitlementEndsAtMs: null,
    });
    assert.deepEqual(householdSponsorProjectionFields(binding), { entitlementOwnerId: 'owner-uid', entitlementStatus: 'active' });
  });

  it('tolerates the casing and padding a hand-edited profile carries, on both sides', () => {
    for (const plan of ['pro', 'Pro', ' PRO ', 'pro\n']) {
      assert.equal(resolveProEntitlement({ plan }, now).isPro, true, plan);
    }
    const binding = buildHouseholdSponsorBinding({
      plan: 'Pro ',
      entitlementSource: 'Admin',
      entitlementStatus: 'ACTIVE',
    }, 'owner-uid', now);
    assert.equal(binding.bindable, true);
    assert.equal(binding.patch.entitlementSource, 'admin');
    assert.equal(binding.patch.entitlementStatus, 'active');
    assert.match(rulesSource, /function isProPlanValue\(value\) \{\s*return value is string && value\.trim\(\)\.lower\(\) == 'pro';/);
    assert.match(rulesSource, /function tokenValue\(value\) \{\s*return value is string \? value\.trim\(\)\.lower\(\) : '';/);
  });

  it('projects an active launch trial exactly as the rules read it', () => {
    const ends = now + 90 * DAY_MS;
    const binding = buildHouseholdSponsorBinding({
      plan: 'pro',
      entitlementSource: 'launch_trial',
      entitlementStatus: 'trialing',
      entitlementStartedAtMs: now,
      entitlementEndsAtMs: ends,
    }, 'owner-uid', now);
    assert.deepEqual(binding.patch, {
      entitlementOwnerId: 'owner-uid',
      entitlementSource: 'launch_trial',
      entitlementStatus: 'trialing',
      entitlementEndsAtMs: ends,
    });
    // Copied exactly - the rules compare the projection against the profile
    // byte for byte, so rounding here would invalidate the write.
    assert.equal(buildHouseholdSponsorBinding({
      plan: 'pro', entitlementEndsAtMs: ends + 0.4,
    }, 'owner-uid', now).patch.entitlementEndsAtMs, ends + 0.4);
  });

  it('refuses to bind anything the profile cannot back', () => {
    assert.equal(buildHouseholdSponsorBinding(null, 'owner-uid', now).bindable, false);
    assert.equal(buildHouseholdSponsorBinding({ plan: 'free' }, 'owner-uid', now).bindable, false);
    // An expired trial is not an entitlement, whatever `plan` still says.
    assert.equal(buildHouseholdSponsorBinding({
      plan: 'pro',
      entitlementSource: 'launch_trial',
      entitlementStatus: 'trialing',
      entitlementEndsAtMs: now - 1,
    }, 'owner-uid', now).bindable, false);
    // A value outside the schema can never satisfy `validHouseholdConfigFields`.
    const bogus = buildHouseholdSponsorBinding({
      plan: 'pro', entitlementSource: 'paypal', entitlementStatus: 'unpaid',
    }, 'owner-uid', now);
    assert.equal(bogus.bindable, false);
    assert.deepEqual(bogus.rejectedFields, ['entitlementSource', 'entitlementStatus']);
  });

  it('keeps the statuses the rules keep, and withdraws the ones they withdraw', () => {
    // The list inside the *entitlement* rule, not any other `status in [...]`
    // the file happens to contain (a course session has its own).
    const rulesAllows = rulesSource.match(/statusToken in \[([^\]]+)\]/)?.[1] ?? '';
    const allowed = rulesAllows.split(',').map((item) => item.trim().replace(/'/g, ''));
    assert.deepEqual(allowed, ['trialing', 'active', 'grace_period', 'canceled']);
    for (const status of allowed) {
      assert.equal(resolveProEntitlement({ plan: 'pro', entitlementStatus: status }, now).isPro, true, status);
    }
    for (const status of ['past_due', 'expired', 'locked']) {
      assert.equal(resolveProEntitlement({ plan: 'pro', entitlementStatus: status }, now).isPro, false, status);
    }
  });

  it('reports a projection as stale only when it really differs', () => {
    const binding = buildHouseholdSponsorBinding({
      plan: 'pro', entitlementSource: 'launch_trial', entitlementStatus: 'trialing', entitlementEndsAtMs: now + DAY_MS,
    }, 'owner-uid', now);
    assert.equal(householdSponsorBindingIsStale({
      entitlementOwnerId: 'owner-uid', entitlementSource: 'launch_trial',
      entitlementStatus: 'trialing', entitlementEndsAtMs: now + DAY_MS,
    }, binding), false);
    assert.equal(householdSponsorBindingIsStale({
      // Legacy document: no pointer at all.
      ownerId: 'owner-uid',
    }, binding), true);
    assert.equal(householdSponsorBindingIsStale({
      ownerId: 'owner-uid', entitlementOwnerId: 'owner-uid', entitlementSource: 'launch_trial',
      entitlementStatus: 'trialing',
      // A stale expiry the profile no longer carries must be deleted, not kept.
      entitlementEndsAtMs: now - DAY_MS,
    }, buildHouseholdSponsorBinding({ plan: 'pro' }, 'owner-uid', now)), true);
    // The rules compare these fields case-insensitively, so must the client.
    assert.equal(householdSponsorBindingIsStale({
      entitlementOwnerId: 'owner-uid', entitlementSource: 'Launch_Trial',
      entitlementStatus: 'Trialing', entitlementEndsAtMs: now + DAY_MS,
    }, binding), false);
    assert.equal(householdSponsorBindingIsStale(null, binding), false);
  });
});

describe('household write denial diagnosis', () => {
  const pro = { plan: 'pro', entitlementSource: 'admin', entitlementStatus: 'active' };
  const diagnose = diagnoseHouseholdWriteDenial;

  it('offers the rebind to an owner whose own plan can pay for the household', () => {
    assert.deepEqual(diagnose({
      household: { ownerId: 'owner-uid', entitlementOwnerId: 'ex-partner' },
      profile: pro, uid: 'owner-uid', isOwner: true, nowMs: now,
    }), 'sponsor-rebindable');
  });

  it('names a lapsed sponsor when there is no entitlement to bind instead', () => {
    assert.deepEqual(diagnose({
      household: { ownerId: 'owner-uid', entitlementOwnerId: 'ex-partner' },
      profile: { plan: 'free' }, uid: 'owner-uid', isOwner: true, nowMs: now,
    }), 'sponsor-lapsed');
  });

  it('never blames a plan a member is not allowed to read', () => {
    assert.deepEqual(diagnose({
      household: { ownerId: 'owner-uid', entitlementOwnerId: 'ex-partner' },
      profile: pro, uid: 'editor-uid', isOwner: false, nowMs: now,
    }), 'sponsor-unreadable');
  });

  it('recognises a household document that never stored a sponsor', () => {
    assert.deepEqual(diagnose({
      household: {}, profile: pro, uid: 'owner-uid', isOwner: true, nowMs: now,
    }), 'sponsor-unset');
  });

  it('falls back to the deployed rules when the sponsor is this account', () => {
    assert.deepEqual(diagnose({
      household: { ownerId: 'owner-uid', entitlementOwnerId: 'owner-uid', entitlementStatus: 'active' },
      profile: pro, uid: 'owner-uid', isOwner: true, nowMs: now,
    }), 'rules-behind');
    // A profile whose fields the schema cannot express is its own answer: not a
    // subscription to buy again, and not a redeploy - the profile is wrong.
    assert.deepEqual(diagnose({
      household: { ownerId: 'owner-uid', entitlementOwnerId: 'owner-uid' },
      profile: { plan: 'pro', entitlementStatus: 'unpaid' }, uid: 'owner-uid', isOwner: true, nowMs: now,
    }), 'profile-invalid');
  });

  it('says the plan lapsed when this account is the sponsor and it is not active', () => {
    assert.deepEqual(diagnose({
      household: { ownerId: 'owner-uid', entitlementOwnerId: 'owner-uid' },
      profile: { plan: 'pro', entitlementSource: 'launch_trial', entitlementEndsAtMs: now - 1 },
      uid: 'owner-uid', isOwner: true, nowMs: now,
    }), 'sponsor-lapsed');
  });

  it('stays silent about what it cannot see', () => {
    assert.deepEqual(diagnose({ household: null, profile: pro, uid: 'owner-uid', isOwner: true, nowMs: now }), 'unknown');
    assert.deepEqual(diagnose({ household: { ownerId: 'a' }, profile: pro, uid: '', isOwner: true, nowMs: now }), 'unknown');
  });
});

describe('rules and client read the same entitlement', () => {
  it('mirrors profileIsPro() for the shapes a real profile can take', () => {
    // `profileIsPro` is the rules transcription of resolveProEntitlement() for
    // every profile that carries an explicit expiry; the legacy
    // `proTrialClaimedAt` marker is the one documented exception (the rules
    // treat a grant with no end as unbounded), so it is excluded here.
    const rulesAllows = (profile: Record<string, unknown>) => {
      const source = entitlementToken(profile.entitlementSource);
      const status = entitlementToken(profile.entitlementStatus);
      const ends = typeof profile.entitlementEndsAtMs === 'number' && profile.entitlementEndsAtMs > 0
        ? profile.entitlementEndsAtMs
        : -1;
      const isProPlan = entitlementToken(profile.plan) === 'pro';
      if (!isProPlan) return false;
      return source === 'launch_trial'
        ? ends >= 0 && ends > now
        : (status === '' || ['trialing', 'active', 'grace_period', 'canceled'].includes(status))
          && (ends < 0 || ends > now);
    };
    const cases: Record<string, unknown>[] = [
      {},
      { plan: 'pro' },
      { plan: 'Pro ', entitlementSource: 'admin' },
      { plan: 'pro', entitlementStatus: 'past_due' },
      { plan: 'pro', entitlementStatus: 'canceled', entitlementEndsAtMs: now + DAY_MS },
      { plan: 'pro', entitlementStatus: 'canceled', entitlementEndsAtMs: now - DAY_MS },
      { plan: 'pro', entitlementSource: 'launch_trial', entitlementStatus: 'trialing', entitlementEndsAtMs: now + DAY_MS },
      { plan: 'pro', entitlementSource: 'launch_trial', entitlementStatus: 'trialing', entitlementEndsAtMs: now - DAY_MS },
      { plan: 'pro', entitlementSource: 'launch_trial', entitlementEndsAtMs: now + DAY_MS },
      { plan: 'pro', entitlementSource: 'launch_trial', entitlementEndsAtMs: 'tomorrow' },
      { plan: 'free', entitlementStatus: 'active' },
      { plan: 'pro', entitlementEndsAtMs: now + DAY_MS },
      { plan: 'pro', entitlementEndsAtMs: 'now + forever' },
    ];
    for (const profile of cases) {
      assert.equal(
        resolveProEntitlement(profile as Parameters<typeof resolveProEntitlement>[0], now).isPro,
        rulesAllows(profile),
        JSON.stringify(profile),
      );
    }
  });

  it('keeps one copy of the entitlement decision, inlined where it is hot', () => {
    // `profileIsPro()` spells the comparisons out instead of calling
    // isProPlanValue()/tokenValue()/millisOrMissing(), because the engine inlines
    // every call into a 1000-expression budget and this condition runs on every
    // shared finance write. That is only safe while the two forms agree, so the
    // inlined text is pinned here: change one and this fails.
    const body = rulesSource
      .slice(
        rulesSource.indexOf('function profileIsPro(profile, nowMs)'),
        rulesSource.indexOf('function entitlementProjectionAgrees'),
      )
      // Comments are prose, not code: they name the helpers this body inlines.
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    assert.match(body, /let plan = profile\.get\('plan', ''\);/);
    assert.match(body, /plan is string && plan\.trim\(\)\.lower\(\) == 'pro'/);
    assert.match(body, /source is string \? source\.trim\(\)\.lower\(\) : ''/);
    assert.match(body, /ends is number && ends > 0 \? ends : -1/);
    assert.doesNotMatch(body, /isProPlanValue\(|tokenValue\(|millisOrMissing\(/);
    // ...and the helpers the rest of the file composes still answer identically.
    assert.match(rulesSource, /function isProPlanValue\(value\) \{\s*return value is string && value\.trim\(\)\.lower\(\) == 'pro';/);
  });

  it('grants the household owner their own workspace even without a membership row', () => {
    // `householdOwner()` is the authoritative ownership check (ownerId is
    // immutable), so `householdEditor()` must not require a row the client
    // cannot always create: a locked-out owner is indistinguishable from a
    // lost budget.
    const editor = rulesSource.slice(
      rulesSource.indexOf('function householdEditor(hid)'),
      rulesSource.indexOf('function householdWriter(hid)'),
    );
    assert.match(editor, /return householdOwner\(hid\)\s*\n\s*\|\| \(member\.get\('status', ''\) == 'active'/);
    assert.match(editor, /member\.get\('role', ''\) == 'owner' \|\| member\.get\('role', ''\) == 'editor'/);
  });
  it('asks each shared write for one pass over the household and its member row', () => {
    // Rules inline every call into one budget of 1000 evaluated expressions per
    // request, and a flush writes the ledger row, the month and the savings document
    // out of that same budget. A gate that re-derived the household root, the
    // membership row or the payer's profile per clause put real users over the cap,
    // and an over-cap request is reported to the client as a plain denial - the bug
    // this file exists to prevent.
    const body = (signature: string) => {
      const at = rulesSource.indexOf(signature);
      assert.notEqual(at, -1, signature);
      return rulesSource.slice(at, rulesSource.indexOf('\n    }', at));
    };
    // The two household-wide gates decide ownership and the entitlement from ONE read
    // of the household root and delegate the membership question to exactly one read
    // of the caller's row. `householdEntitled()`, `householdOwner()` and
    // `memberDocument()` each fetch a document the gate is already holding, and
    // `householdAccess()` answered four questions where a write asks two - rules
    // evaluate every field of a returned map, so a branch needing half of them still
    // paid for all of them.
    for (const [gateName, memberHelper] of [
      ['householdLedgerGate', 'ledgerMemberWriteOk'],
      ['householdSavingsGate', 'savingsMemberWriteOk'],
    ] as [string, string][]) {
      const signature = `function ${gateName}(hid`;
      const gate = body(signature);
      assert.equal((gate.match(/householdPath\(hid\)/g) ?? []).length, 1, signature);
      assert.match(gate, /let sponsor = householdSponsor\(root\);/, signature);
      assert.match(gate, /activeProEntitlement\(sponsor\)/, signature);
      assert.ok(gate.includes(`${memberHelper}(hid, uid`),
        `${signature} must ask membership once, through ${memberHelper}()`);
      assert.doesNotMatch(gate, /householdAccess\(|householdEntitled\(|householdOwner\(|memberDocument\(/, signature);
      // ...and the helper it delegates to reads the member row once, not per clause.
      const helper = body(`function ${memberHelper}(hid, uid`);
      assert.equal((helper.match(/memberPath\(hid, uid\)/g) ?? []).length, 1, memberHelper);
      assert.doesNotMatch(helper, /householdAccess\(|householdEntitled\(|householdOwner\(|householdPath\(/, memberHelper);
    }
    // One statement per method, dispatching inside ONE facts record. The shared month
    // rules were once split by writer kind - three `allow update` statements and two
    // `allow create` - on the theory that each statement gets its own expression
    // budget. It does not: a request is charged every `allow` statement it consults,
    // so the split paid for the household root, the membership row and the sponsor's
    // profile once per statement, and importing a budget, flushing the outbox and
    // closing a period aborted with "maximum of 1000 expressions to evaluate has been
    // reached" while every authorization fact in the request was in order (CI run
    // 33928520670). `npm run test:rules` is what proves this, and it is the gate.
    // The personal months document keeps its own statements at the other end of the
    // file, so the block is located from the shared write it must contain.
    const sharedMonthAt = rulesSource.indexOf('allow create: if monthCreateShared(hid)');
    assert.notEqual(sharedMonthAt, -1, 'the shared month write must go through monthCreateShared()');
    const monthBlock = rulesSource.slice(
      rulesSource.lastIndexOf('match /months/{key} {', sharedMonthAt),
      rulesSource.indexOf('match /data/savings {', sharedMonthAt),
    );
    assert.equal((monthBlock.match(/allow update:/g) ?? []).length, 1,
      'a second shared month update statement buys back the budget the split cost');
    assert.equal((monthBlock.match(/allow create:/g) ?? []).length, 1,
      'a second shared month create statement buys back the budget the split cost');
    for (const signature of [
      'function monthUpdateShared(hid) {',
      'function monthCreateShared(hid) {',
    ]) {
      const gate = body(signature);
      assert.equal((gate.match(/monthWriteFacts\(hid\)/g) ?? []).length, 1, signature);
      assert.doesNotMatch(gate, /householdAccess\(|householdEntitled\(|householdOwner\(|memberDocument\(/, signature);
    }
    // The facts record reads the household root and the member row once each, and
    // names the sponsor before asking about it: passed inline it is re-expanded at
    // each of `userProfileData()`'s uses of it.
    {
      const facts = body('function monthWriteFacts(hid) {');
      assert.equal((facts.match(/householdPath\(hid\)/g) ?? []).length, 1, 'monthWriteFacts');
      assert.equal((facts.match(/memberPath\(hid, uid\)/g) ?? []).length, 1, 'monthWriteFacts');
      assert.match(facts, /let sponsor = householdSponsor\(root\);/, 'monthWriteFacts');
    }
    // Inside the one statement the dispatch still runs cheapest first, because the
    // short-circuit that keeps the common write inside the budget now lives in the
    // expression rather than in the statement order: the entitlement, then the
    // replayed ledger row, then the rare transition, and the per-area grant walk -
    // which visits every changed key - only for a writer who is actually a custom
    // member. The document-shape check follows the same dispatch: a transition may
    // only move period-state keys, so it is not charged `validMonthDocument()`.
    {
      const gate = body('function monthUpdateShared(hid) {');
      assert.ok(gate.indexOf('facts.paid') < gate.indexOf('customMonthChangesGranted'),
        'facts.paid is the cheapest discriminator and must be asked before the grant walk');
      assert.ok(gate.indexOf('facts.custom') < gate.indexOf('customMonthChangesGranted'),
        'the grant walk must not be reached for a writer who is not a custom member');
      // ...and the document-shape check is chosen by the transition the dispatch
      // already computed, from the `wasClosed`/`willBeClosed` in scope, rather than
      // re-deriving both documents' period state in the statement above it. A
      // transition may only move period-state keys, so the money checks in
      // `validMonthDocument()` cannot be violated by it and it is validated as period
      // fields only; an ordinary edit keeps the full document check. Each exactly
      // once, because this is the tightest budget in the file.
      assert.equal((gate.match(/validMonthDocument\(\)/g) ?? []).length, 1,
        'the ordinary edit must pay the full shape check once, not once per arm');
      assert.equal((gate.match(/validMonthPeriodFields\(\)/g) ?? []).length, 1,
        'the transition must be validated as period fields once');
      assert.match(gate, /\? \(facts\.owner[\s\S]*&& validMonthPeriodFields\(\)\)/,
        'the close/reopen arm is the one validated as period fields only');
    }
    // The superseded gates are gone, not merely unused: leaving either wrong shape in
    // the file invites a future rule to call one and re-inherit its cost. The folded
    // all-in-one gate charged every branch for the others; the per-statement split
    // charged the request for each statement. Both are recorded here so neither
    // returns as the "optimization" that fixes the other.
    for (const gone of [
      'monthUpdateAuthorized', 'householdMonthGate', 'monthWriterOk', 'householdAccess',
      'monthFinanceWriterFacts', 'monthCustomWriterFacts', 'monthOrdinaryUpdateByFinanceWriter',
      'monthCreateByFinanceWriter', 'monthCreateByCustomMember', 'monthUpdateByCustomMember',
      'monthCloseReopenByOwner',
    ]) {
      assert.doesNotMatch(rulesSource, new RegExp(`function ${gone}\\(`),
        `${gone}() is a superseded month-gate shape; calling it re-buys the budget bug it was written to fix`);
    }
    // And no rule reads a mutation's ledger row through a hand-built path twice.
    assert.doesNotMatch(
      rulesSource,
      /exists\w*\(\/databases\/\$\(database\)\/documents\/households\/\$\(hid\)\/ledger\/\$\(incoming\(\)\.lastMutationId\)\)/,
    );
  });
});

/**
 * The second way a paid owner is refused by their own workspace: the published
 * rules let a household owner create their membership row, but no screen offered
 * to write it, so an owner whose row was deleted (or who joined before the roster
 * was the source of truth) could only see the refusal. `planHouseholdMembershipRepair`
 * is the decision that keeps that write inside what the rules allow.
 */
describe('planning the missing membership row', () => {
  const uid = 'u1';
  const household = (over: Record<string, unknown> = {}) =>
    ({ id: 'h1', name: 'Home', ownerId: uid, createdAt: '2025-11-14T22:13:20.000Z', ...over });
  const row = (over: Record<string, unknown> = {}) =>
    ({ role: 'owner', status: 'active', ...over });

  it('does nothing for anyone but the household owner, and for no household', () => {
    assert.deepEqual(planHouseholdMembershipRepair({ uid, household: null, member: null }), {
      action: 'none',
      reason: 'not-owner',
    });
    assert.deepEqual(planHouseholdMembershipRepair({ uid: null, household: household(), member: null }), {
      action: 'none',
      reason: 'not-owner',
    });
    assert.deepEqual(planHouseholdMembershipRepair({ uid, household: household({ ownerId: 'someone-else' }), member: null }), {
      action: 'none',
      reason: 'not-owner',
    });
  });

  it('writes the row the published rules will accept', () => {
    const plan = planHouseholdMembershipRepair({ uid, household: household(), member: null, email: 'owner@flousy.app' });
    assert.equal(plan.action, 'write');
    if (plan.action !== 'write') return;
    assert.equal(plan.replace, false, 'a row that does not exist is created, not replaced');
    assert.deepEqual(plan.member, {
      id: uid,
      userId: uid,
      displayName: 'owner',
      email: 'owner@flousy.app',
      role: 'owner',
      status: 'active',
      joinedAt: household().createdAt,
    });
  });

  it('replaces a row filed under somebody else, keeping the date it found', () => {
    const plan = planHouseholdMembershipRepair({
      uid,
      household: household(),
      member: row({ role: 'profile', joinedAt: '2024-01-01T00:00:00.000Z' }),
      nowIso: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(plan.action, 'write');
    if (plan.action !== 'write') return;
    assert.equal(plan.replace, true, 'a row under a different record has to be deleted and rewritten');
    assert.equal(plan.member.joinedAt, '2024-01-01T00:00:00.000Z', 'the date they joined is not the date we noticed');
    assert.equal(plan.member.role, 'owner');
    assert.equal(plan.member.userId, uid);
  });

  it('leaves a row that already says owner alone', () => {
    assert.deepEqual(planHouseholdMembershipRepair({ uid, household: household(), member: row() }), {
      action: 'none',
      reason: 'already-owner',
    });
  });

  it('does not re-activate somebody the household removed', () => {
    // An owner may create their own row and repair it; un-suspending a member the
    // household deliberately removed is a different decision, and the published
    // rules refuse it anyway (`resource.data.role != 'owner'` on the update branch).
    const plan = planHouseholdMembershipRepair({
      uid,
      household: household(),
      member: row({ status: 'removed' }),
    });
    assert.deepEqual(plan, { action: 'blocked', reason: 'owner-row-not-active' });
  });
});

describe('a freshly created household accuses nobody', () => {
  // The workspace panel used to show a "Restore shared access" card reading
  // "the Pro plan that pays for this household belongs to another account" to
  // an owner who had just created the household seconds earlier, on their own
  // plan, with no write having been refused at all. Two bugs met:
  //
  //  * `diagnoseHouseholdWriteDenial` answers the question "given that a write
  //    was refused, why?" - its fallthrough is `rules-behind`, never "nothing
  //    is wrong". The panel called it unconditionally, so a perfectly healthy
  //    household reported `rules-behind` at rest.
  //  * The card was then shown for `rules-behind`/`unknown`, i.e. for exactly
  //    the state the diagnosis reports when it has found nothing.
  //
  // The panel no longer renders that card, and the diagnosis is consulted only
  // from a `permission-denied` handler. These assertions pin the shape of the
  // household `create()` writes so the "another account" wording can never be
  // reached for a self-sponsored workspace.
  const uid = 'owner-1';
  const profiles: [string, Record<string, unknown>][] = [
    ['an unbounded grant carrying no status or expiry', { plan: 'pro' }],
    ['a paid subscription', {
      plan: 'pro', entitlementSource: 'stripe', entitlementStatus: 'active',
      entitlementEndsAtMs: Date.now() + 30 * 86_400_000,
    }],
    ['the launch trial', {
      plan: 'pro', entitlementSource: 'launch_trial', entitlementStatus: 'active',
      entitlementEndsAtMs: Date.now() + 5 * 86_400_000,
    }],
  ];

  for (const [label, profile] of profiles) {
    it(`binds cleanly to its creator on ${label}`, () => {
      const binding = buildHouseholdSponsorBinding(profile, uid);
      assert.equal(binding.bindable, true, 'the creator must be able to sponsor');
      assert.deepEqual(binding.rejectedFields, []);
      // Exactly the document `household-context.create()` stores.
      const household = {
        ownerId: uid,
        planOwnerId: uid,
        ...householdSponsorProjectionFields(binding),
      };
      // The sponsor is the creator, and the stored projection already matches
      // the profile - so there is nothing for a repair to do.
      assert.equal(householdSponsorId(household), uid);
      assert.equal(householdSponsorBindingIsStale(household, binding), false,
        'a household written by create() is never stale the moment it is created');
      // And the sponsor-related denials, the ones whose copy blames another
      // account or a lapsed plan, are unreachable for it.
      const denial = diagnoseHouseholdWriteDenial({ household, profile, uid, isOwner: true });
      assert.ok(
        !['sponsor-rebindable', 'sponsor-lapsed', 'sponsor-unset', 'sponsor-unreadable'].includes(denial),
        `a self-sponsored household must not be diagnosed as ${denial}`,
      );
    });
  }

  it('never offers the sponsor repair to the account that already sponsors', () => {
    // `sponsor-rebindable` is what drives the "belongs to another account"
    // copy. It is returned only when the stored sponsor is somebody else.
    const profile = { plan: 'pro' };
    const binding = buildHouseholdSponsorBinding(profile, uid);
    const mine = { ownerId: uid, planOwnerId: uid, ...householdSponsorProjectionFields(binding) };
    assert.notEqual(
      diagnoseHouseholdWriteDenial({ household: mine, profile, uid, isOwner: true }),
      'sponsor-rebindable',
    );
    const theirs = { ...mine, entitlementOwnerId: 'someone-else' };
    assert.equal(
      diagnoseHouseholdWriteDenial({ household: theirs, profile, uid, isOwner: true }),
      'sponsor-rebindable',
      'and it stays available for the case it actually describes',
    );
  });

  it('has no standing "restore shared access" card left to mis-fire', () => {
    const panel = readFileSync(
      new URL('../src/components/dashboard/profile/workspace-panel.tsx', import.meta.url),
      'utf8',
    );
    // The card rendered from state computed at rest, with no refusal in hand.
    assert.doesNotMatch(panel, /canRestoreSharedAccess|sponsorStale|restoreSharedAccess/,
      'the panel must not decide at rest that shared access needs restoring');
    // The remaining reference is inside the permission-denied handler.
    assert.match(panel, /code !== 'permission-denied'/);
  });
});

describe('the owner membership row can be torn down by its own holder', () => {
  it('exempts self-deletion from the owner-row protection', () => {
    // The reported teardown failure was
    //   [household-delete] refused: households/<hid>/members/<own uid>
    // with callerIsOwner true, sponsorIsCaller true and an active plan - i.e.
    // nothing to do with entitlement. `allow delete` on a member row required
    // `role != 'owner'`, which is exactly the row a workspace teardown must
    // remove last, so deleting a household could never complete.
    const start = rulesSource.indexOf('match /members/{memberId} {');
    const block = rulesSource.slice(start, rulesSource.indexOf('match /invoices/{invoiceId} {', start));
    const rule = block.slice(block.indexOf('allow delete:'));
    assert.match(rule, /memberId == request\.auth\.uid/,
      'an owner must be able to delete their own row or the workspace cannot be removed');
    assert.match(rule, /resource\.data\.get\('role', ''\) != 'owner'/,
      "and another owner's row must stay protected");
  });

  it('still resolves ownership without the membership row', () => {
    // What makes the exemption safe: ownership is read off the household root,
    // so removing the row cannot lock the owner out mid-teardown.
    const gate = rulesSource.slice(rulesSource.indexOf('function householdOwner(hid) {'));
    const body = gate.slice(0, gate.indexOf('\n    }'));
    assert.match(body, /ownerId/);
    assert.doesNotMatch(body, /memberPath\(|memberDocument\(/,
      'householdOwner must not depend on the row the teardown deletes');
  });
});
