import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isProUser, isProPlan } from '../src/lib/pro-features';

describe('Pro feature gating', () => {
  it('treats a pro profile as premium access', () => {
    assert.equal(isProUser({ plan: 'pro' } as any), true);
  });

  it('resolves Pro from the Firebase profile plan, not a local flag', () => {
    const storage = {
      getItem: (key: string) => (key === 'flousy_pro_plan' ? 'true' : null),
    } as Storage;

    // A Firebase profile always wins — a stale local demo flag cannot
    // promote a profile whose plan is 'free'.
    assert.equal(isProUser({ plan: 'free' } as any, storage), false);
    assert.equal(isProUser({ plan: 'pro' } as any, storage), true);
  });

  it('honors the demo flag only inside an active demo session', () => {
    const proFlag = {
      getItem: (key: string) => (key === 'flousy_pro_plan' ? 'true' : null),
    } as Storage;
    const demoSession = {
      getItem: (key: string) =>
        key === 'flousy_pro_plan' ? 'true' : key === 'flousy_demo_mode' ? 'true' : null,
    } as Storage;

    // `profile === null` also means "signed in, profile still loading". Serving
    // Pro from a leftover `flousy_pro_plan` key in that window handed premium
    // features to anyone who had once tried the demo, so the flag is only
    // consulted when the demo session itself is active.
    assert.equal(isProUser(null, proFlag), false);
    assert.equal(isProUser(null, demoSession), true);
    assert.equal(isProUser(null), false);
  });

  it('keeps free users blocked from premium features', () => {
    assert.equal(isProUser({ plan: 'free' } as any), false);
  });
});


describe('Pro plan normalisation (isProPlan)', () => {
  it('accepts pro regardless of casing or stray whitespace', () => {
    for (const value of ['pro', 'Pro', 'PRO', ' pro ', '\tPRO\n']) {
      assert.equal(isProPlan(value), true, JSON.stringify(value));
    }
  });
  it('rejects free, empty, null and unrelated strings', () => {
    for (const value of ['free', '', 'trial', 'premium', null, undefined]) {
      assert.equal(isProPlan(value as string | null | undefined), false, String(value));
    }
  });
  it('isProUser agrees with isProPlan on a loaded profile', () => {
    assert.equal(isProUser({ plan: 'Pro' } as any), true);
    assert.equal(isProUser({ plan: 'free' } as any), false);
  });
});

describe('90-day launch trial entitlement (resolveProEntitlement)', () => {
  const DAY = 86_400_000;
  const NOW = 1_800_000_000_000;

  it('exposes the exact 90-day duration the Firestore rules enforce', async () => {
    const { PRO_TRIAL_DURATION_MS } = await import('../src/lib/pro-features');
    assert.equal(PRO_TRIAL_DURATION_MS, 90 * DAY);
  });

  it('grants nothing to a free profile or a missing profile', async () => {
    const { resolveProEntitlement } = await import('../src/lib/pro-features');
    for (const profile of [null, { plan: 'free' }, { plan: '' }, {}]) {
      const e = resolveProEntitlement(profile as any, NOW);
      assert.deepEqual(
        { isPro: e.isPro, isTrialActive: e.isTrialActive, isTrialExpired: e.isTrialExpired },
        { isPro: false, isTrialActive: false, isTrialExpired: false },
      );
    }
  });

  it('an active trial is Pro with a day countdown (ceil, never 0 while active)', async () => {
    const { resolveProEntitlement } = await import('../src/lib/pro-features');
    const endsAt = NOW + 90 * DAY;
    const fresh = resolveProEntitlement({ plan: 'pro', proTrialEndsAtMs: endsAt, planSource: 'launch_trial' } as any, NOW);
    assert.equal(fresh.isPro, true);
    assert.equal(fresh.isTrialActive, true);
    assert.equal(fresh.trialDaysRemaining, 90);
    // One millisecond before expiry still counts as Pro with 1 day shown.
    const lastMoment = resolveProEntitlement({ plan: 'pro', proTrialEndsAtMs: endsAt } as any, endsAt - 1);
    assert.equal(lastMoment.isPro, true);
    assert.equal(lastMoment.trialDaysRemaining, 1);
  });

  it('an expired trial is Free even though plan still reads pro', async () => {
    const { resolveProEntitlement, isProUser } = await import('../src/lib/pro-features');
    const profile = { plan: 'pro', proTrialEndsAtMs: NOW, planSource: 'launch_trial' } as any;
    // The boundary instant itself is already expired (strict `<`).
    const e = resolveProEntitlement(profile, NOW);
    assert.equal(e.isPro, false);
    assert.equal(e.isTrialExpired, true);
    assert.equal(e.trialDaysRemaining, 0);
    assert.equal(e.trialEndsAtMs, NOW);
  });

  it('billing/legacy Pro (no trial window) never expires here', async () => {
    const { resolveProEntitlement } = await import('../src/lib/pro-features');
    for (const profile of [
      { plan: 'pro' },
      { plan: 'pro', planSource: 'billing' },
      { plan: 'pro', proTrialEndsAtMs: null },
    ]) {
      const e = resolveProEntitlement(profile as any, NOW + 10_000 * DAY);
      assert.equal(e.isPro, true, JSON.stringify(profile));
      assert.equal(e.isTrialActive, false);
      assert.equal(e.isTrialExpired, false);
    }
  });

  it('isProUser follows the entitlement, not the raw plan string', async () => {
    const { isProUser } = await import('../src/lib/pro-features');
    // Live trial (ends far in the future relative to real now).
    assert.equal(isProUser({ plan: 'pro', proTrialEndsAtMs: Date.now() + DAY } as any), true);
    // Lapsed trial: plan says pro, entitlement says Free.
    assert.equal(isProUser({ plan: 'pro', proTrialEndsAtMs: Date.now() - DAY } as any), false);
  });
});
