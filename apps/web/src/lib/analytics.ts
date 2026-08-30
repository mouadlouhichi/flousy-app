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

let analytics: Analytics | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;
let analyticsLogEvent: ((instance: Analytics, name: string, params?: Record<string, unknown>) => void) | null = null;

async function ensureAnalytics(): Promise<Analytics | null> {
  if (analytics) return analytics;
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

  // Firebase Analytics tracking (chunk loaded on demand)
  const instance = await ensureAnalytics();
  if (instance && analyticsLogEvent) {
    try {
      analyticsLogEvent(instance, eventName, params);
    } catch (err) {
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
