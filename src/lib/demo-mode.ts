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

/** Whether the demo user has already finished onboarding (persisted locally). */
export function isOnboardingDoneLocally(monthKey?: string): boolean {
  if (safeGet(ONBOARDING_DONE_KEY) === 'true') return true;
  if (monthKey) {
    return safeGet(`flousy_month_${monthKey}`) !== null;
  }
  return false;
}
