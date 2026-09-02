/**
 * Onboarding-flag scoping (the "onboarding never fired for a new user" bug).
 *
 * A demo session writes a GLOBAL `flousy_onboarding_done` flag and caches
 * month documents under `flousy_month_*`. When a real account then signs up on
 * the same browser, those leftovers must NOT satisfy the onboarding check —
 * otherwise login routes the new user straight to /dashboard and the
 * dashboard "self-heal" marks the cloud profile as onboarded forever.
 *
 * Contract under test:
 *  - real accounts (uid provided) trust only `flousy_onboarding_done_<uid>`;
 *  - demo sessions (no uid) keep the historical global-flag + month-cache path;
 *  - clearDemoResidue() wipes demo leftovers but keeps uid-scoped flags.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage double so the module's `typeof window !== 'undefined'`
// guards resolve the same way they do in a browser.
function installFakeWindow(): Map<string, string> {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
    clear: () => { store.clear(); },
  };
  (globalThis as Record<string, unknown>).window = { localStorage };
  return store;
}

const {
  isOnboardingDoneLocally,
  markOnboardingDoneLocally,
  clearDemoResidue,
  enableDemoMode,
  exitDemoMode,
  isDemoMode,
} = await import('../src/lib/demo-mode');

test('demo session keeps the historical global flag + month-cache fallback', () => {
  const store = installFakeWindow();

  assert.equal(isOnboardingDoneLocally(), false);
  markOnboardingDoneLocally(); // no uid → demo/global flag
  assert.equal(isOnboardingDoneLocally(), true);

  store.clear();
  assert.equal(isOnboardingDoneLocally('2026-09'), false);
  store.set('flousy_month_2026-09', '{"totalBudget":1000}');
  assert.equal(isOnboardingDoneLocally('2026-09'), true, 'cached month acts as demo fallback');
});

test('a real account never trusts demo leftovers (global flag or cached months)', () => {
  const store = installFakeWindow();

  // Simulate demo residue on the browser.
  store.set('flousy_onboarding_done', 'true');
  store.set('flousy_month_2026-09', '{"totalBudget":1000}');

  assert.equal(
    isOnboardingDoneLocally('2026-09', 'new-user-uid'),
    false,
    'new account must be routed to onboarding despite demo residue',
  );

  markOnboardingDoneLocally('new-user-uid');
  assert.equal(isOnboardingDoneLocally('2026-09', 'new-user-uid'), true);
  assert.equal(
    isOnboardingDoneLocally('2026-09', 'other-user-uid'),
    false,
    'completion is per account, not per browser',
  );
});

test('clearDemoResidue wipes demo state but preserves uid-scoped flags and unrelated keys', () => {
  const store = installFakeWindow();

  enableDemoMode('demo@flousy.app');
  assert.equal(isDemoMode(), true);
  store.set('flousy_onboarding_done', 'true');
  store.set('flousy_month_2026-08', '{}');
  store.set('flousy_month_2026-09', '{}');
  store.set('flousy_currency', 'MAD');
  markOnboardingDoneLocally('real-uid');

  clearDemoResidue();

  assert.equal(isDemoMode(), false);
  assert.equal(store.has('flousy_onboarding_done'), false);
  assert.equal(store.has('flousy_month_2026-08'), false);
  assert.equal(store.has('flousy_month_2026-09'), false);
  assert.equal(store.get('flousy_currency'), 'MAD', 'unrelated preferences survive');
  assert.equal(isOnboardingDoneLocally(undefined, 'real-uid'), true, 'uid-scoped flag survives');
});

test('demo mode toggles on and off', () => {
  installFakeWindow();
  assert.equal(isDemoMode(), false, 'off by default');
  enableDemoMode('a@b.c');
  assert.equal(isDemoMode(), true);
  exitDemoMode();
  assert.equal(isDemoMode(), false);
});

test('never throws when localStorage is unavailable (sandboxed/blocked)', () => {
  delete (globalThis as Record<string, unknown>).window;
  assert.equal(isDemoMode(), false);
  enableDemoMode('a@b.c'); // must not throw
  exitDemoMode();
  markOnboardingDoneLocally('uid');
  clearDemoResidue();
  assert.equal(isOnboardingDoneLocally('2026-08'), false);
  assert.equal(isOnboardingDoneLocally(undefined, 'uid'), false);
});
