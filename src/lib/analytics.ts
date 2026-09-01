import { app } from './firebase';

import type { Analytics } from 'firebase/analytics';

/**
 * Analytics and Telemetry Seam
 * Opt-in telemetry. By default, it is a clean no-op seam that respects privacy.
 *
 * The `firebase/analytics` module is code-split: it is imported the first
 * time an event is actually tracked instead of being bunded into the
 * dashboard's initial load.
 */

/**
 * Consent flag for the consent-less default this module used to have.
 *
 * Firebase Analytics used to be initialised the first time any screen tracked
 * an event — i.e. before the user had been asked anything — while `/cookies`
 * promised that analytics were never enabled without a choice. The flag is read
 * before the module is even imported, and a missing value means "not asked
 * yet", not "yes".
 */
export const CONSENT_STORAGE_KEY = 'flousy_analytics_consent';

function analyticsConsented(): boolean {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function hasAnsweredAnalyticsConsent(): boolean {
  try {
    const value = localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'granted' || value === 'denied';
  } catch {
    return false;
  }
}

export function setAnalyticsConsent(granted: boolean): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, granted ? 'granted' : 'denied');
  } catch {
    // A private-mode storage failure must not block the UI; the default
    // (no tracking) then stays in force.
  }
  if (granted) void ensureAnalytics();
}

let analytics: Analytics | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;
let analyticsLogEvent: ((instance: Analytics, name: string, params?: Record<string, unknown>) => void) | null = null;

async function ensureAnalytics(): Promise<Analytics | null> {
  if (analytics) return analytics;
  if (!analyticsConsented()) return null;
  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      try {
        const { getAnalytics, isSupported, logEvent: log } = await import('firebase/analytics');
        if (app && (await isSupported())) {
          analytics = getAnalytics(app);
        }
        analyticsLogEvent = log;
      } catch {
        analytics = null;
      }
      return analytics;
    })();
  }
  return analyticsPromise;
}

export async function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  // Nothing is measured, and nothing is loaded, until the user has said yes.
  if (!analyticsConsented()) return;

  // Firebase Analytics tracking (chunk loaded on demand)
  const instance = await ensureAnalytics();
  if (instance && analyticsLogEvent) {
    try {
      analyticsLogEvent(instance, eventName, params);
    } catch {
      // Ignore analytics errors
    }
  }

  const provider = process.env.NEXT_PUBLIC_ANALYTICS;
  if (!provider) {
    // No-op by default
    return;
  }

  try {
    if (provider === 'plausible' && (window as any).plausible) {
      (window as any).plausible(eventName, { props: params });
    } else if (provider === 'ga' && (window as any).gtag) {
      (window as any).gtag('event', eventName, params);
    }
  } catch {
    // Ignore telemetry errors
  }
}
