import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

export const runtime = 'nodejs';

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  topic: z.string().trim().max(120).optional().default(''),
  message: z.string().trim().min(10).max(5000),
  locale: z.enum(['en', 'fr', 'ar']).optional().default('en'),
  requestId: z.string().uuid(),
  // Real visitors never see this field. A filled value is accepted but dropped
  // so basic form bots do not learn how to bypass the trap.
  website: z.string().max(200).optional().default(''),
});

const WINDOW_MS = 15 * 60 * 1000;
const MAX_MESSAGES = 5;
const requestsByIp = new Map<string, number[]>();
const deliveries = new Map<string, { at: number; state: 'pending' | 'accepted' }>();

function clientIp(request: NextRequest): string {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function isRateLimited(ip: string, now = Date.now()): boolean {
  const recent = (requestsByIp.get(ip) || []).filter((at) => now - at < WINDOW_MS);
  recent.push(now);
  requestsByIp.set(ip, recent);
  if (requestsByIp.size > 5000) {
    for (const [key, hits] of requestsByIp) {
      if (!hits.some((at) => now - at < WINDOW_MS)) requestsByIp.delete(key);
    }
  }
  return recent.length > MAX_MESSAGES;
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser clients are still constrained by rate limits
  try {
    const expectedHost = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').toLowerCase();
    return new URL(origin).host.toLowerCase() === expectedHost;
  } catch {
    return false;
  }
}

function isProductionDeployment(): boolean {
  const vercelEnvironment = process.env.VERCEL_ENV;
  if (vercelEnvironment) return vercelEnvironment === 'production';
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

function response(code: string, status: number) {
  return NextResponse.json({ ok: status < 400, code }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** Configuration probe for deployment smoke tests; sends no email or secret. */
export async function GET() {
  const from = process.env.RESEND_FROM_EMAIL || '';
  const sandboxSender = from.toLowerCase().includes('@resend.dev');
  const configured = Boolean(process.env.RESEND_API_KEY && from && process.env.CONTACT_TO_EMAIL);
  const ready = configured && !(isProductionDeployment() && sandboxSender);
  return NextResponse.json({
    ready,
    code: ready ? 'ready' : configured ? 'sandbox_sender' : 'contact_not_configured',
    sandboxSender,
    environment: isProductionDeployment()
      ? 'production'
      : process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return response('origin_not_allowed', 403);
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > 20_000) return response('request_too_large', 413);

  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    const result = response('rate_limited', 429);
    result.headers.set('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
    return result;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return response('invalid_json', 400);
  }
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return response('invalid_contact', 400);
  const input = parsed.data;
  if (input.website) return response('accepted', 202);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL;
  const sandboxSender = from?.toLowerCase().includes('@resend.dev') ?? false;
  if (!apiKey || !from || !to || (isProductionDeployment() && sandboxSender)) {
    return response('contact_not_configured', 503);
  }

  const now = Date.now();
  for (const [id, delivery] of deliveries) {
    if (now - delivery.at > 24 * 60 * 60 * 1000) deliveries.delete(id);
  }
  const prior = deliveries.get(input.requestId);
  if (prior?.state === 'accepted') return response('already_accepted', 200);
  if (prior?.state === 'pending') return response('delivery_in_progress', 409);
  // Reserve before calling Resend so two concurrent requests with the same
  // idempotency key cannot emit duplicate email. Failures release the key.
  deliveries.set(input.requestId, { at: now, state: 'pending' });

  const safeTopic = input.topic.replace(/[\r\n]+/g, ' ').trim() || 'SmartJib contact form';
  const resend = new Resend(apiKey);
  try {
    const result = await resend.emails.send({
      from,
      to: [to],
      replyTo: input.email,
      subject: `[SmartJib] ${safeTopic}`,
      text: [
        `Name: ${input.name}`,
        `Email: ${input.email}`,
        `Locale: ${input.locale}`,
        `Request: ${input.requestId}`,
        '',
        input.message,
      ].join('\n'),
      html: `
        <h2>SmartJib contact message</h2>
        <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
        <p><strong>Locale:</strong> ${escapeHtml(input.locale)}</p>
        <p><strong>Request:</strong> ${escapeHtml(input.requestId)}</p>
        <hr />
        <p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>
      `,
    }, {
      // Resend applies this across serverless instances. The local reservation
      // handles concurrent requests in one process; the provider key prevents a
      // retry routed to another instance (or after a restart) from duplicating
      // the same message.
      idempotencyKey: `contact-${input.requestId}`,
    });
    if (result.error) {
      deliveries.delete(input.requestId);
      console.error('[contact] delivery failed', { code: result.error.name });
      return response('delivery_failed', 502);
    }
    // Resend returning an ID means the request was accepted by the provider; a
    // later mailbox bounce is still possible without a delivery webhook.
    deliveries.set(input.requestId, { at: Date.now(), state: 'accepted' });
    return response('accepted_for_delivery', 202);
  } catch (error) {
    deliveries.delete(input.requestId);
    console.error('[contact] delivery failed', {
      name: error instanceof Error ? error.name : 'unknown',
    });
    return response('delivery_failed', 502);
  }
}
