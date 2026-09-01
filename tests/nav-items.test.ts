import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_NAV_ITEMS,
  PROFILE_SUBPAGE_NAV_ITEMS,
  getProfilePageTitle,
  getProfileSubpageNavItems,
  getScreenIdFromPath,
  getVisibleNavItems,
} from '../src/components/dashboard/nav-items';

describe('Profile subpage nav items', () => {
  it('exposes the account pages for the grouped desktop sidebar', () => {
    assert.deepEqual(
      getProfileSubpageNavItems(false).map((item) => item.id),
      ['preferences', 'money-sources', 'data', 'account'],
    );
  });

  it('adds the household page only where household management is allowed', () => {
    assert.ok(getProfileSubpageNavItems(true).some((item) => item.id === 'household'));
    assert.ok(!getProfileSubpageNavItems(false).some((item) => item.id === 'household'));
  });

  it('never puts a profile subpage in the bottom nav', () => {
    const navIds: string[] = getVisibleNavItems(true).map((item) => item.id);
    for (const item of PROFILE_SUBPAGE_NAV_ITEMS) {
      assert.ok(!navIds.includes(item.id), `${item.id} must stay in the sidebar`);
    }
  });

  it('links every subpage to a real profile route', () => {
    for (const item of PROFILE_SUBPAGE_NAV_ITEMS) {
      assert.match(item.href, /^\/dashboard\/profile\//);
      assert.strictEqual(getScreenIdFromPath(item.href), 'profile');
    }
  });
});

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

  it('resolves the courses route but keeps it out of the nav bars', () => {
    assert.strictEqual(getScreenIdFromPath('/dashboard/courses'), 'courses');
    for (const isPro of [false, true]) {
      assert.ok(
        !getVisibleNavItems(isPro).some((item) => item.id === 'courses'),
        'courses is reached from the quick actions, not the nav',
      );
    }
  });
});
