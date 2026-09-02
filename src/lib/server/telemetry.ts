/**
 * Server-side telemetry sinks for the client-error beacon.
 *
 * The browser already posts a small, consent-gated, sanitized report to
 * `/api/client-errors` (see `observability-reporter.tsx`); this module
 * optionally FORWARDS that same report to hosted backends — no client SDK, no
 * extra script, no CSP change, and nothing new is collected:
 *
 *  - Sentry: `SENTRY_DSN` (or `NEXT_PUBLIC_SENTRY_DSN`) set → the report is
 *    posted to Sentry's envelope endpoint with a plain `fetch`.
 *  - Better Stack (Logtail): `BETTERSTACK_API_KEY` set → the report is posted
 *    to the ingest host (`BETTERSTACK_URL`, defaulting to
 *    https://in.logs.betterstack.com) as one structured log line. Better
 *    Stack UPTIME monitors are external configuration, not code — see
 *    PRODUCTION_CHECKLIST §8.
 *
 * Without env vars both sinks are inert. Failures are swallowed after a short
 * timeout: a broken telemetry backend must never break the error sink itself.
 */

export interface ClientErrorReport {
  kind: string;
  message: string;
  stack: string;
  path: string;
  userAgent: string;
  at: string;
}

const SINK_TIMEOUT_MS = 2500;

// --- Sentry (envelope API, no SDK) ------------------------------------------

/**
 * Derive the envelope endpoint from a DSN
 * (`https://<key>@<host>/<projectId>`). Returns null for anything that does
 * not look like a DSN, so a misconfigured env var degrades to "disabled".
 */
export function sentryEndpointFromDsn(dsn: string): string | null {
  const match = /^https:\/\/([a-f0-9]+)(?::[^@]*)?@([^/@\s]+)\/(\d+)$/i.exec(dsn.trim());
  if (!match) return null;
  const [, publicKey, host, projectId] = match;
  return `https://${host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`;
}

/** Build the three-line envelope body Sentry's ingest endpoint expects. */
export function sentryEnvelopeFromReport(report: ClientErrorReport, eventId: string): string {
  const event = {
    event_id: eventId,
    timestamp: report.at,
    platform: 'javascript',
    level: 'error',
    logger: 'flousy.client-errors',
    message: { formatted: report.message },
    tags: { kind: report.kind, path: report.path },
    extra: { stack: report.stack, userAgent: report.userAgent },
  };
  return [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');
}

async function forwardToSentry(report: ClientErrorReport): Promise<void> {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const endpoint = sentryEndpointFromDsn(dsn);
  if (!endpoint) return;
  const eventId = crypto.randomUUID().replace(/-/g, '');
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: sentryEnvelopeFromReport(report, eventId),
      signal: AbortSignal.timeout(SINK_TIMEOUT_MS),
    });
  } catch {
    /* telemetry must never throw */
  }
}

// --- Better Stack logs (Logtail ingest) --------------------------------------

async function forwardToBetterStack(report: ClientErrorReport): Promise<void> {
  const token = process.env.BETTERSTACK_API_KEY;
  if (!token) return;
  const url = (process.env.BETTERSTACK_URL || 'https://in.logs.betterstack.com').replace(/\/+$/, '');
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dt: report.at,
        level: 'error',
        message: `[client-error] ${report.kind}: ${report.message}`,
        kind: report.kind,
        path: report.path,
        stack: report.stack,
        userAgent: report.userAgent,
      }),
      signal: AbortSignal.timeout(SINK_TIMEOUT_MS),
    });
  } catch {
    /* telemetry must never throw */
  }
}

/**
 * Forward one client-error report to every configured sink. Resolves after
 * all sinks settle (bounded by their timeouts) and never rejects.
 */
export async function forwardClientErrorReport(report: ClientErrorReport): Promise<void> {
  await Promise.allSettled([forwardToSentry(report), forwardToBetterStack(report)]);
}
