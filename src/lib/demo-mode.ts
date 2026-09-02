/**
 * Demo-mode helpers (preview / no-Firebase fallback).
 *
 * When Firebase isn't configured (local dev, the Arena preview, or a deploy
 * without env vars), authentication degrades to a localStorage "demo" session
 * keyed by `flousy_demo_mode`. Everything here is defensive: blocked or
 * partitioned storage must never crash a render or break navigation.
 */

export const DEMO_MODE_KEY = 'flousy_demo_mode';
const DEMO_EMAIL_KEY = 'flousy_demo_email';
const ONBOARDING_DONE_KEY = 'flousy_onboarding_done';

function safeGet(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked/full — ignore */
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isDemoMode(): boolean {
  return safeGet(DEMO_MODE_KEY) === 'true';
}

/** Enter demo mode (used by the preview login + the demo banner CTA). */
export function enableDemoMode(email?: string): void {
  safeSet(DEMO_MODE_KEY, 'true');
  if (email) safeSet(DEMO_EMAIL_KEY, email);
}

/** Leave demo mode so the real sign-in form is reachable again. */
export function exitDemoMode(): void {
  safeRemove(DEMO_MODE_KEY);
  safeRemove(DEMO_EMAIL_KEY);
}

function onboardingKeyFor(uid: string): string {
  return `${ONBOARDING_DONE_KEY}_${uid}`;
}

/**
 * Whether onboarding has already been finished on this device.
 *
 * Real accounts (a `uid` is provided) trust ONLY their own uid-scoped flag.
 * The legacy global flag and cached month documents are deliberately ignored
 * for them: those can be leftovers from a demo session — or from a different
 * account — on the same browser, and trusting them used to route brand-new
 * users straight to the dashboard, where the "self-heal" then wrote
 * `onboardingComplete: true` to the new profile and onboarding never fired.
 *
 * Demo sessions (no `uid`) keep the historical behaviour: the global flag,
 * with any cached month document as fallback.
 */
export function isOnboardingDoneLocally(monthKey?: string, uid?: string): boolean {
  if (uid) return safeGet(onboardingKeyFor(uid)) === 'true';
  if (safeGet(ONBOARDING_DONE_KEY) === 'true') return true;
  if (monthKey) {
    return safeGet(`flousy_month_${monthKey}`) !== null;
  }
  return false;
}

/**
 * Persist local onboarding completion — uid-scoped for real accounts so it can
 * never bleed into another account (or out of a demo session), global for demo.
 */
export function markOnboardingDoneLocally(uid?: string): void {
  if (uid) safeSet(onboardingKeyFor(uid), 'true');
  else safeSet(ONBOARDING_DONE_KEY, 'true');
}

/**
 * Purge everything a demo session left behind. Called when a real Firebase
 * user signs in on a browser that previously ran the demo: the demo flag, the
 * global onboarding flag and any locally cached month documents would
 * otherwise masquerade as the new account's data.
 */
export function clearDemoResidue(): void {
  exitDemoMode();
  safeRemove(ONBOARDING_DONE_KEY);
  try {
    if (typeof window === 'undefined') return;
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('flousy_month_')) doomed.push(key);
    }
    doomed.forEach((key) => safeRemove(key));
  } catch {
    /* storage blocked — ignore */
  }
}
