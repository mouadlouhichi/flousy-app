import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited } from '@/lib/server/rate-limit';
import { forwardClientErrorReport } from '@/lib/server/telemetry';

export const runtime = 'nodejs';

/**
 * Minimal client-error sink.
 *
 * Browsers POST a small, sanitized beacon here when an unhandled error or
 * rejection escapes the app (see `src/components/observability-reporter.tsx`).
 * The report is written to the server log (`console.error`), which is exactly
 * where the hosting platform's log drain / alerting picks it up — no storage,
 * no third-party SDK, no cookies, and nothing personal beyond what an error
 * message itself may contain. When `SENTRY_DSN` and/or `BETTERSTACK_API_KEY`
 * are configured, the same already-sanitized report is additionally forwarded
 * server-side to Sentry / Better Stack (see `src/lib/server/telemetry.ts`);
 * without those env vars nothing leaves the server log.
 *
 * Abuse posture: the endpoint is public by necessity, so payloads are tightly
 * capped and per-IP rate-limited (durably, when Upstash Redis is configured);
 * over-limit and malformed reports are acknowledged with 204 (a failing
 * reporter must never cause more errors).
 */

const WINDOW_MS = 60_000;
const MAX_REPORTS_PER_WINDOW = 10;

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export async function POST(request: NextRequest) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'unknown';
  if (await isRateLimited('client-errors', ip, MAX_REPORTS_PER_WINDOW, WINDOW_MS)) {
    return new NextResponse(null, { status: 204 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const report = {
    kind: clip(body.kind, 40) || 'error',
    message: clip(body.message, 500),
    stack: clip(body.stack, 1500),
    path: clip(body.path, 200),
    userAgent: clip(request.headers.get('user-agent'), 200),
    at: new Date().toISOString(),
  };
  if (report.message) {
    // The one log line the platform's alerting can key on.
    console.error('[client-error]', JSON.stringify(report));
    // Optional hosted sinks; awaited so serverless doesn't kill the calls,
    // bounded by short internal timeouts, and never throws.
    await forwardClientErrorReport(report);
  }
  return new NextResponse(null, { status: 204 });
}
