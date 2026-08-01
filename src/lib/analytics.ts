import { logEvent } from 'firebase/analytics';
import { analytics } from './firebase';

/**
 * Analytics and Telemetry Seam
 * Opt-in telemetry. By default, it is a clean no-op seam that respects privacy.
 */

export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return;

  // Firebase Analytics tracking
  if (analytics) {
    try {
      logEvent(analytics, eventName, params);
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
