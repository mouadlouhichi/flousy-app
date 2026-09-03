import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildHouseholdSponsorBinding,
  diagnoseHouseholdWriteDenial,
  householdSponsorBindingIsStale,
  householdSponsorId,
  householdSponsorProjectionFields,
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
    for (const signature of [
      'function householdMonthGate(hid, grantsChecked) {',
      'function householdLedgerGate(hid) {',
      'function householdSavingsGate(hid) {',
      'function monthUpdateAuthorized(hid) {',
    ]) {
      const gate = body(signature);
      assert.equal((gate.match(/householdAccess\(hid\)/g) ?? []).length, 1, signature);
      assert.doesNotMatch(gate, /householdEntitled\(|householdOwner\(|memberDocument\(/, signature);
    }
    // The writer test itself exists once, and the month rules share it.
    assert.equal((rulesSource.match(/monthWriterOk\(/g) ?? []).length, 3);
    assert.match(body('function monthWriterOk(access, grantsChecked) {'), /access\.paid && \(access\.owner \|\| access\.editor/);
    assert.match(
      rulesSource,
      /allow update: if monthUpdateAuthorized\(hid\)\n\s*&& isValidMonthId\(key\)/,
    );
    // And no rule reads a mutation's ledger row through a hand-built path twice.
    assert.doesNotMatch(
      rulesSource,
      /exists\w*\(\/databases\/\$\(database\)\/documents\/households\/\$\(hid\)\/ledger\/\$\(incoming\(\)\.lastMutationId\)\)/,
    );
  });
});
