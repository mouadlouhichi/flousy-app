import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isProUser } from '../src/lib/pro-features';

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

  it('honors the demo flag only when no Firebase profile exists', () => {
    const storage = {
      getItem: (key: string) => (key === 'flousy_pro_plan' ? 'true' : null),
    } as Storage;

    assert.equal(isProUser(null, storage), true);
    assert.equal(isProUser(null), false);
  });

  it('keeps free users blocked from premium features', () => {
    assert.equal(isProUser({ plan: 'free' } as any), false);
  });
});
