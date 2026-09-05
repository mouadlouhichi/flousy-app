'use client';

import { useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import { trackEvent } from '@/lib/analytics';

/**
 * Production observability, kept deliberately small:
 *
 * 1. Unhandled errors / promise rejections send a sanitized beacon to
 *    `/api/client-errors`, whose only job is to land the report in the server
 *    log where platform alerting can see it. No SDK, no storage, no cookies.
 * 2. Web Vitals go through `trackEvent`, which is a no-op until the user has
 *    granted analytics consent — performance telemetry obeys the same choice
 *    as every other measurement.
 *
 * Renders nothing.
 */

const REPORT_LIMIT = 10;
let reported = 0;

/** Send one sanitized error beacon; safe to call from anywhere client-side. */
export function reportClientError(kind: string, message: string, stack?: string): void {
  report(kind, message, stack);
}

function report(kind: string, message: string, stack?: string): void {
  if (reported >= REPORT_LIMIT) return; // a crash loop must not DOS ourselves
  reported += 1;
  try {
    const body = JSON.stringify({
      kind,
      message: String(message || '').slice(0, 500),
      stack: String(stack || '').slice(0, 1500),
      path: window.location.pathname,
    });
    // sendBeacon survives page unloads; fetch keepalive is the fallback.
    if (!navigator.sendBeacon?.('/api/client-errors', new Blob([body], { type: 'application/json' }))) {
      void fetch('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // Never let the reporter itself throw.
  }
}

/**
 * Known Chrome DevTools bug (see GoogleChrome/web-vitals#792): with DevTools
 * open, the Performance-panel integration injects its own copy of web-vitals
 * as an anonymous `VM*` script, which throws
 * `Cannot read properties of undefined (reading 'startTime')` from
 * `reportAllChanges` on soft navigations. It originates in the browser — not
 * in app code — so it must never be beaconed as an app error.
 */
function isDevToolsVitalsNoise(message: string, stack?: string): boolean {
  return message.includes("reading 'startTime'") && (stack?.includes('reportAllChanges') ?? false);
}

export function ObservabilityReporter() {
  useReportWebVitals((metric) => {
    try {
      // Defensive: a malformed metric must never break rendering.
      if (!metric || typeof metric.name !== 'string' || typeof metric.value !== 'number') return;
      // Consent-gated by trackEvent; whole-number values keep payloads tiny.
      void trackEvent('web_vitals', {
        metric: metric.name,
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        rating: metric.rating,
      });
    } catch {
      // Never let telemetry throw.
    }
  });

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const stack = event.error instanceof Error ? event.error.stack : undefined;
      if (typeof event.message === 'string' && isDevToolsVitalsNoise(event.message, stack)) return;
      report('error', event.message, stack);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report(
        'unhandledrejection',
        reason instanceof Error ? reason.message : String(reason ?? 'unknown'),
        reason instanceof Error ? reason.stack : undefined,
      );
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
