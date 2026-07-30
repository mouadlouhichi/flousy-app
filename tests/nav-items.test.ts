import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_NAV_ITEMS,
  getScreenIdFromPath,
  getVisibleNavItems,
} from '../src/components/dashboard/nav-items';

describe('Dashboard navigation items', () => {
  it('keeps the bottom nav at 5 destinations for free users and 6 for PRO', () => {
    assert.strictEqual(getVisibleNavItems(false).length, 5);
    assert.strictEqual(getVisibleNavItems(true).length, 6);
  });

  it('never surfaces the profile page in the nav bars', () => {
    for (const isPro of [false, true]) {
      assert.ok(
        !getVisibleNavItems(isPro).some((item) => item.id === 'profile'),
        'profile is reached from the avatar button, not the nav',
      );
    }
  });

  it('still resolves the profile route to its own screen id', () => {
    assert.strictEqual(getScreenIdFromPath('/dashboard/profile'), 'profile');
    assert.strictEqual(getScreenIdFromPath('/dashboard'), 'overview');
    assert.strictEqual(getScreenIdFromPath('/dashboard/trends'), 'trends');
  });

  it('gives every destination a unique id and href', () => {
    const ids = DASHBOARD_NAV_ITEMS.map((i) => i.id);
    const hrefs = DASHBOARD_NAV_ITEMS.map((i) => i.href);
    assert.strictEqual(new Set(ids).size, ids.length);
    assert.strictEqual(new Set(hrefs).size, hrefs.length);
  });
});
