import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_NAV_ITEMS,
  getProfilePageTitle,
  getScreenIdFromPath,
  getVisibleNavItems,
} from '../src/components/dashboard/nav-items';

describe('Dashboard navigation items', () => {
  it('keeps the bottom nav focused at 5 destinations for free and PRO users', () => {
    assert.strictEqual(getVisibleNavItems(false).length, 5);
    assert.strictEqual(getVisibleNavItems(true).length, 5);
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
    for (const page of ['preferences', 'money-sources', 'workspace', 'pro', 'data', 'account']) {
      assert.strictEqual(
        getScreenIdFromPath(`/dashboard/profile/${page}`),
        'profile',
        `${page} must not light up Overview in the main nav`,
      );
    }
    assert.strictEqual(getScreenIdFromPath('/dashboard'), 'overview');
    assert.strictEqual(getScreenIdFromPath('/dashboard/trends'), 'trends');
    assert.strictEqual(getProfilePageTitle('/dashboard/profile/preferences'), 'Preferences');
    assert.strictEqual(getProfilePageTitle('/dashboard/profile/money-sources'), 'Money Sources');
  });

  it('gives every destination a unique id and href', () => {
    const ids = DASHBOARD_NAV_ITEMS.map((i) => i.id);
    const hrefs = DASHBOARD_NAV_ITEMS.map((i) => i.href);
    assert.strictEqual(new Set(ids).size, ids.length);
    assert.strictEqual(new Set(hrefs).size, hrefs.length);
  });
});
