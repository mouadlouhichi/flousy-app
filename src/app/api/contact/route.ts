import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const runtime = 'nodejs';

/**
 * Public contact endpoint.
 *
 * The contact page used to render a form that flipped to "message sent"
 * without transmitting anything — a fake-success state flagged by the 2026-09
 * audit. This route makes the form real: validated, size-bounded, HTML-escaped
 * mail to a monitored inbox, with a readiness GET so the client can fall back
 * to a plain support-email link when the deployment has no mail credentials.
 *
 * Abuse posture (the form is public, so it needs more care than the
 * authenticated invitation route):
 *  - per-IP token bucket, in-memory per instance (outer bound: Resend quota
 *    and host/WAF limits — see PRODUCTION_CHECKLIST §5);
 *  - honeypot field: bots that fill `website` get a fake success and no mail;
 *  - idempotency: a client-generated `requestId` suppresses duplicate sends
 *    from retries/double-clicks within the dedupe window;
 *  - the submitter's address goes into Reply-To, never into From.
 */

const SANDBOX_SENDER = '@resend.dev';
const WINDOW_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const sendsByIp = new Map<string, number[]>();

const DEDUPE_WINDOW_MS = 30 * 60 * 1000;
const seenRequestIds = new Map<string, number>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (sendsByIp.get(ip) || []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  sendsByIp.set(ip, hits);
  if (sendsByIp.size > 5000) {
    for (const [key, times] of sendsByIp) {
      if (!times.some((at) => now - at < WINDOW_MS)) sendsByIp.delete(key);
    }
  }
  return hits.length > MAX_SENDS_PER_WINDOW;
}

/** True when this requestId already produced a send recently. */
function duplicateRequest(requestId: string): boolean {
  const now = Date.now();
  if (seenRequestIds.size > 10000) {
    for (const [key, at] of seenRequestIds) {
      if (now - at > DEDUPE_WINDOW_MS) seenRequestIds.delete(key);
    }
  }
  const seenAt = seenRequestIds.get(requestId);
  if (seenAt !== undefined && now - seenAt < DEDUPE_WINDOW_MS) return true;
  seenRequestIds.set(requestId, now);
  return false;
}

function isProductionDeployment(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv === 'production';
  return process.env.NODE_ENV === 'production';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface ContactPayload {
  name: string;
  email: string;
  topic: string;
  message: string;
  requestId: string;
}

/** Returns the validated payload or the field that failed. */
function validate(body: unknown): { payload: ContactPayload } | { invalid: string } {
  const raw = (body || {}) as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  const topic = typeof raw.topic === 'string' ? raw.topic.trim() : '';
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  const requestId = typeof raw.requestId === 'string' ? raw.requestId.trim() : '';
  if (!name || name.length > 120) return { invalid: 'name' };
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return { invalid: 'email' };
  if (topic.length > 150) return { invalid: 'topic' };
  if (!message || message.length > 5000) return { invalid: 'message' };
  if (!requestId || requestId.length > 80) return { invalid: 'requestId' };
  return { payload: { name, email, topic, message, requestId } };
}

function readiness() {
  const from = process.env.RESEND_FROM_EMAIL || 'SmartJib <onboarding@resend.dev>';
  const configured = Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.CONTACT_TO_EMAIL);
  const sandboxSender = from.includes(SANDBOX_SENDER);
  const code = !configured
    ? 'email_not_configured'
    : isProductionDeployment() && sandboxSender
      ? 'sandbox_sender'
      : 'ready';
  return { ready: code === 'ready', code, sandboxSender };
}

/** Readiness probe — sends nothing and reveals no secret. */
export async function GET() {
  const state = readiness();
  return NextResponse.json({
    ...state,
    environment: isProductionDeployment() ? 'production' : process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL || 'SmartJib <onboarding@resend.dev>';

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.', code: 'invalid_body' }, { status: 400 });
  }

  // Honeypot: legitimate users never see or fill this field. Answer with the
  // same shape as success so scripts cannot detect the trap.
  const honeypot = (body as Record<string, unknown> | null)?.website;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return NextResponse.json({ sent: true, code: 'sent' });
  }

  const result = validate(body);
  if ('invalid' in result) {
    return NextResponse.json(
      { error: `Invalid or missing field: ${result.invalid}.`, code: 'invalid_field', field: result.invalid },
      { status: 400 },
    );
  }

  if (!apiKey || !to) {
    // Truthful degradation: the client shows the direct support address
    // instead of pretending the message went somewhere.
    return NextResponse.json({
      error: 'Contact email is not configured for this deployment.',
      code: 'email_not_configured',
      hint: 'Set RESEND_API_KEY, RESEND_FROM_EMAIL and CONTACT_TO_EMAIL for this environment, then redeploy.',
    }, { status: 503 });
  }
  if (isProductionDeployment() && from.includes(SANDBOX_SENDER)) {
    return NextResponse.json({
      error: 'Production cannot send from the Resend sandbox domain.',
      code: 'sandbox_sender',
      hint: 'Verify a sending domain in Resend and set RESEND_FROM_EMAIL to it.',
    }, { status: 503 });
  }

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many messages from this address; try again later.', code: 'rate_limited' },
      { status: 429 },
    );
  }

  const { payload } = result;
  if (duplicateRequest(payload.requestId)) {
    // Retried submission: the first one already produced a mail.
    return NextResponse.json({ sent: true, code: 'sent', deduplicated: true });
  }

  const subject = `[SmartJib contact] ${payload.topic || payload.name}`.slice(0, 200);
  const html = `
    <div style="font-family:sans-serif;max-width:600px">
      <h2 style="margin:0 0 12px">New contact message</h2>
      <p style="margin:0 0 4px"><strong>From:</strong> ${escapeHtml(payload.name)} &lt;${escapeHtml(payload.email)}&gt;</p>
      ${payload.topic ? `<p style="margin:0 0 4px"><strong>Topic:</strong> ${escapeHtml(payload.topic)}</p>` : ''}
      <p style="margin:0 0 4px"><strong>Request ID:</strong> ${escapeHtml(payload.requestId)}</p>
      <hr style="border:none;border-top:1px solid #ddd;margin:12px 0" />
      <p style="white-space:pre-wrap;margin:0">${escapeHtml(payload.message)}</p>
    </div>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: payload.email,
      subject,
      html,
    });
    if (error) {
      // Not sent — forget the requestId so an honest retry is not swallowed
      // by the dedupe check.
      seenRequestIds.delete(payload.requestId);
      return NextResponse.json(
        { error: 'The email provider rejected the message.', code: 'provider_rejected' },
        { status: 502 },
      );
    }
  } catch {
    seenRequestIds.delete(payload.requestId);
    return NextResponse.json(
      { error: 'The email provider could not be reached.', code: 'provider_unreachable' },
      { status: 502 },
    );
  }

  return NextResponse.json({ sent: true, code: 'sent' });
}
