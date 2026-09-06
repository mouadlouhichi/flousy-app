import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBulkImportAccess } from '../src/lib/import-access';
import { resolveAreaAccess } from '../src/lib/household-rbac';
import { PRO_TRIAL_DURATION_MS } from '../src/lib/pro-features';

const start = Date.UTC(2026, 8, 2);
const endsAtMs = start + PRO_TRIAL_DURATION_MS;
const trialProfile = {
  plan: 'pro',
  entitlementSource: 'launch_trial',
  entitlementStatus: 'trialing',
  entitlementStartedAtMs: start,
  entitlementEndsAtMs: endsAtMs,
} as const;

const personalWriter = () => true;

describe('bulk import mutation access', () => {
  it('re-evaluates a personal trial at each mutation boundary', () => {
    const beforeExpiry = resolveBulkImportAccess({
      profile: trialProfile,
      workspace: 'personal',
      canWriteArea: personalWriter,
      storage: null,
      nowMs: endsAtMs - 1,
    });
    assert.deepEqual(beforeExpiry, {
      entitled: true,
      areas: { expenses: true, fixedBills: true },
    });

    // The same profile and already-open importer loses access at the exact end.
    const atExpiry = resolveBulkImportAccess({
      profile: trialProfile,
      workspace: 'personal',
      canWriteArea: personalWriter,
      storage: null,
      nowMs: endsAtMs,
    });
    assert.deepEqual(atExpiry, {
      entitled: false,
      areas: { expenses: false, fixedBills: false },
    });
  });

  it('keeps Free personal accounts read-only at the bulk-import boundary', () => {
    const access = resolveBulkImportAccess({
      profile: { plan: 'free' },
      workspace: 'personal',
      canWriteArea: personalWriter,
      storage: null,
      nowMs: start,
    });

    assert.equal(access.entitled, false);
    assert.equal(access.areas.expenses, false);
    assert.equal(access.areas.fixedBills, false);
  });

  it('combines household entitlement expiry with mutation-time RBAC', () => {
    const household = {
      entitlementSource: 'launch_trial' as const,
      entitlementStatus: 'trialing' as const,
      entitlementEndsAtMs: endsAtMs,
    };
    const editor = resolveAreaAccess({ unrestricted: false, role: 'editor' });
    const viewer = resolveAreaAccess({ unrestricted: false, role: 'viewer' });

    const editorAccess = resolveBulkImportAccess({
      profile: { plan: 'free' },
      workspace: 'household',
      household,
      canWriteArea: editor.canEdit,
      storage: null,
      nowMs: endsAtMs - 1,
    });
    assert.deepEqual(editorAccess, {
      entitled: true,
      areas: { expenses: true, fixedBills: true },
    });

    const viewerAccess = resolveBulkImportAccess({
      profile: { plan: 'free' },
      workspace: 'household',
      household,
      canWriteArea: viewer.canEdit,
      storage: null,
      nowMs: endsAtMs - 1,
    });
    assert.equal(viewerAccess.entitled, true);
    assert.deepEqual(viewerAccess.areas, { expenses: false, fixedBills: false });

    const expiredAccess = resolveBulkImportAccess({
      profile: { plan: 'free' },
      workspace: 'household',
      household,
      canWriteArea: editor.canEdit,
      storage: null,
      nowMs: endsAtMs,
    });
    assert.deepEqual(expiredAccess, {
      entitled: false,
      areas: { expenses: false, fixedBills: false },
    });
  });
});
