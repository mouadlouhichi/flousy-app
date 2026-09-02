import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRO_TRIAL_DURATION_MS,
  claimDemoProTrial,
  isProPlan,
  isProUser,
  resolveProEntitlement,
} from '../src/lib/pro-features';

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('Pro feature gating', () => {
  it('treats a legacy/admin pro profile as premium access', () => {
    assert.equal(isProUser({ plan: 'pro' }), true);
  });

  it('expires a launch trial at its immutable end boundary', () => {
    const start = Date.UTC(2026, 8, 2);
    const profile = {
      plan: 'pro',
      entitlementSource: 'launch_trial',
      entitlementStatus: 'trialing',
      entitlementStartedAtMs: start,
      entitlementEndsAtMs: start + PRO_TRIAL_DURATION_MS,
    } as const;

    const active = resolveProEntitlement(profile, start + 1);
    assert.equal(active.isPro, true);
    assert.equal(active.status, 'trialing');
    assert.equal(active.daysRemaining, 90);
    assert.equal(active.hasUsedTrial, true);

    const expired = resolveProEntitlement(profile, profile.entitlementEndsAtMs);
    assert.equal(expired.isPro, false);
    assert.equal(expired.status, 'expired');
    assert.equal(expired.daysRemaining, 0);
  });

  it('expires legacy beta claims after the same 90-day window', () => {
    const start = Date.UTC(2026, 8, 2);
    const profile = { plan: 'pro', proTrialClaimedAt: new Date(start).toISOString() } as const;
    assert.equal(isProUser(profile, null, start + PRO_TRIAL_DURATION_MS - 1), true);
    assert.equal(isProUser(profile, null, start + PRO_TRIAL_DURATION_MS), false);
  });

  it('does not let paid past-due or expired projections unlock Pro', () => {
    const now = Date.UTC(2026, 8, 2);
    assert.equal(isProUser({
      plan: 'pro', entitlementSource: 'stripe', entitlementStatus: 'past_due', entitlementEndsAtMs: now + 1,
    }, null, now), false);
    assert.equal(isProUser({
      plan: 'pro', entitlementSource: 'cmi', entitlementStatus: 'active', entitlementEndsAtMs: now,
    }, null, now), false);
    assert.equal(isProUser({
      plan: 'pro', entitlementSource: 'stripe', entitlementStatus: 'canceled', entitlementEndsAtMs: now + 1,
    }, null, now), true);
  });

  it('resolves Firebase profiles before any local demo flag', () => {
    const storage = memoryStorage({ flousy_pro_plan: 'true', flousy_demo_mode: 'true' });
    assert.equal(isProUser({ plan: 'free' }, storage), false);
    assert.equal(isProUser({ plan: 'pro' }, storage), true);
  });

  it('starts one expiry-aware demo trial only in local demo storage', () => {
    const now = Date.UTC(2026, 8, 2);
    const storage = memoryStorage({ flousy_demo_mode: 'true' });
    assert.equal(claimDemoProTrial(storage, now), true);
    assert.equal(claimDemoProTrial(storage, now + 1), false);
    assert.equal(isProUser(null, storage, now + PRO_TRIAL_DURATION_MS - 1), true);
    assert.equal(isProUser(null, storage, now + PRO_TRIAL_DURATION_MS), false);
  });

  it('never treats a leftover demo plan flag as authenticated entitlement', () => {
    const planOnly = memoryStorage({ flousy_pro_plan: 'true' });
    assert.equal(isProUser(null, planOnly), false);
    assert.equal(isProUser(null), false);
  });
});

describe('Pro plan normalisation', () => {
  it('accepts pro regardless of casing or stray whitespace', () => {
    for (const value of ['pro', 'Pro', 'PRO', ' pro ', '\tPRO\n']) {
      assert.equal(isProPlan(value), true, JSON.stringify(value));
    }
  });

  it('rejects free, empty, null and unrelated strings', () => {
    for (const value of ['free', '', 'trial', 'premium', null, undefined]) {
      assert.equal(isProPlan(value), false, String(value));
    }
  });
});

