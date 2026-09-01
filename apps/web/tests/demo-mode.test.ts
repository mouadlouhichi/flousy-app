import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  enableDemoMode,
  exitDemoMode,
  isDemoMode,
  isOnboardingDoneLocally,
} from '../src/lib/demo-mode';

/** Minimal localStorage stand-in — the helpers only use get/set/remove. */
function makeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

describe('demo-mode helpers', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).window = { localStorage: makeStorage() };
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it('is off by default', () => {
    assert.equal(isDemoMode(), false);
  });

  it('enables, detects, and exits demo mode', () => {
    enableDemoMode('a@b.c');
    assert.equal(isDemoMode(), true);
    exitDemoMode();
    assert.equal(isDemoMode(), false);
  });

  it('tracks onboarding completion via the flag or saved month data', () => {
    assert.equal(isOnboardingDoneLocally('2026-08'), false);
    enableDemoMode();
    (window as unknown as { localStorage: ReturnType<typeof makeStorage> }).localStorage.setItem(
      'flousy_onboarding_done',
      'true',
    );
    assert.equal(isOnboardingDoneLocally('2026-08'), true);

    exitDemoMode();
    (window as unknown as { localStorage: ReturnType<typeof makeStorage> }).localStorage.removeItem(
      'flousy_onboarding_done',
    );
    (window as unknown as { localStorage: ReturnType<typeof makeStorage> }).localStorage.setItem(
      'flousy_month_2026-08',
      '{}',
    );
    assert.equal(isOnboardingDoneLocally('2026-08'), true);
    assert.equal(isOnboardingDoneLocally('2026-07'), false);
  });

  it('never throws when localStorage is unavailable (sandboxed/blocked)', () => {
    delete (globalThis as Record<string, unknown>).window;
    assert.equal(isDemoMode(), false);
    enableDemoMode('a@b.c'); // must not throw
    exitDemoMode();
    assert.equal(isOnboardingDoneLocally('2026-08'), false);
  });
});
