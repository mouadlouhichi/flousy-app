import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isProUser } from '../src/lib/pro-features';

describe('Pro feature gating', () => {
  it('treats a pro profile as premium access', () => {
    assert.equal(isProUser({ plan: 'pro' } as any), true);
  });

  it('treats the local demo flag as premium access for free users', () => {
    const storage = {
      getItem: (key: string) => (key === 'flousy_pro_plan' ? 'true' : null),
    } as Storage;

    assert.equal(isProUser({ plan: 'free' } as any, storage), true);
  });

  it('keeps free users blocked from premium features', () => {
    assert.equal(isProUser({ plan: 'free' } as any), false);
    assert.equal(isProUser(null), false);
  });
});
