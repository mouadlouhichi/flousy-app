import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import en from '../../../../messages/en.json';
import fr from '../../../../messages/fr.json';
import ar from '../../../../messages/ar.json';
import { formatMessage, type Language, type Messages } from '@/lib/i18n-core';
import { verifyFirebaseIdToken, type TokenRejection } from '@/lib/firebase-id-token';

export const runtime = 'nodejs';

const EMAIL_MESSAGES: Record<Language, Messages> = { en, fr, ar };

/** Roles a signed-in member may be invited with; mirrors `householdInvites` in firestore.rules. */
const INVITABLE_ROLES = ['editor', 'viewer', 'contributor', 'custom'] as const;

/**
 * Only domains the sender is expected to control. Resend's own sandbox domain is
 * refused outside preview builds, otherwise a production deploy that still ships
 * the default `onboarding@resend.dev` sender silently drops every invite.
 */
const SANDBOX_SENDER = '@resend.dev';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* -------------------------------------------------------------------------- */
/* Abuse limits                                                                */
/* -------------------------------------------------------------------------- */

/**
 * This endpoint turns a request into an email sent from our own domain, so an
 * unauthenticated version of it was an open mail-relay and phishing primitive:
 * anyone could put any text in `householdName` and mail it to any address.
 * Requests are therefore tied to a signed-in Firebase user, and each user gets a
 * small budget of sends per window.
 *
 * The store is per instance and in-memory — enough to stop a scripted flood, not
 * a distributed one; Resend's own account limits are the outer bound.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 8;
const sendsByUid = new Map<string, number[]>();

function rateLimited(uid: string): boolean {
  const now = Date.now();
  const hits = (sendsByUid.get(uid) || []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  sendsByUid.set(uid, hits);
  // Keep the map from growing without bound on a long-lived instance.
  if (sendsByUid.size > 5000) {
    for (const [key, times] of sendsByUid) {
      if (!times.some((at) => now - at < WINDOW_MS)) sendsByUid.delete(key);
    }
  }
  return hits.length > MAX_SENDS_PER_WINDOW;
}

/**
 * Who is calling, established cryptographically rather than by trust.
 *
 * `NEXT_PUBLIC_FIREBASE_PROJECT_ID` is required because it is what pins the
 * token's issuer and audience to *this* project: without it, a valid ID token
 * from any other Firebase project would verify. It is a public value (the
 * browser bundle contains it), so reading it server-side is not a secret
 * dependency — unlike the previous implementation, which needed the API key
 * merely to ask Identity Toolkit who the caller was, and therefore answered
 * `401 unauthorized` to logged-in users whenever that variable was absent from
 * the function's environment. A missing project id is now reported as
 * `auth_not_configured` (503) so a deployment mistake does not look like a
 * broken account.
 */
/** A verified caller, or why the token was refused. */
type Caller = { uid: string; email?: string };
type CallerIdentity = Caller | { reason: TokenRejection | 'auth_not_configured' };

function isCaller(value: CallerIdentity): value is Caller {
  return typeof (value as Caller).uid === 'string';
}

async function identifyCaller(token: string): Promise<CallerIdentity> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return { reason: 'auth_not_configured' };
  const result = await verifyFirebaseIdToken(token, {
    projectId,
    // Optional refinement only; the route works without it.
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  });
  if ('uid' in result) return { uid: result.uid, email: result.email };
  return { reason: result.reason };
}

/** Firestore document fields, decoded from the REST representation. */
function decodeField(value: unknown): unknown {
  const record = value as Record<string, unknown> | null;
  if (!record || typeof record !== 'object') return undefined;
  if ('stringValue' in record) return record.stringValue;
  if ('integerValue' in record) return Number(record.integerValue);
  if ('booleanValue' in record) return record.booleanValue;
  if ('mapValue' in record) return decodeDocument(record.mapValue);
  return undefined;
}

function decodeDocument(fields: unknown): Record<string, unknown> {
  const source = (fields as Record<string, unknown>) || {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) out[key] = decodeField(value);
  return out;
}

/**
 * Read the invitation the client says it just created, using **the caller's own
 * credentials** against the Firestore REST API.
 *
 * That is the point: the security rules decide visibility, so a caller can only
 * ever mail an invitation it is allowed to see (rules require `invitedBy ==
 * auth.uid` or household ownership). The request body therefore supplies an id,
 * not the recipient address, the role or the household name — none of those are
 * trusted from the client any more.
 */
async function readDocument(collection: string, id: string, token: string): Promise<Record<string, unknown> | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
    `/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { fields?: unknown };
    return decodeDocument(body.fields);
  } catch {
    return null;
  }
}

/**
 * Deployment environment as the platform sees it.
 *
 * `NODE_ENV` is `production` on Vercel **preview** deployments too, so guarding
 * the sandbox sender on it made every preview build refuse to mail anything —
 * which is precisely where a reviewer tests the invite flow. `VERCEL_ENV`
 * distinguishes the two; it is only consulted when absent in favour of NODE_ENV.
 */
function isProductionDeployment(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv === 'production';
  return process.env.NODE_ENV === 'production';
}

/**
 * Base URL for the accept link.
 *
 * The previous fallback derived the base from the incoming request's own URL,
 * i.e. from the caller's `Host` header — attacker-controlled text, on an email
 * whose link grants household access. Only platform-provided values are used
 * now: previews point at the preview deployment (so the flow is testable) and
 * production at the explicitly configured site origin.
 */
function resolveAppBaseUrl(): string {
  const production = isProductionDeployment();
  const candidates = production
    ? [process.env.APP_URL, process.env.NEXT_PUBLIC_SITE_URL, vercelUrl('VERCEL_PROJECT_PRODUCTION_URL')]
    : [vercelUrl('VERCEL_URL'), vercelUrl('VERCEL_PROJECT_PRODUCTION_URL'), process.env.APP_URL, process.env.NEXT_PUBLIC_SITE_URL];
  for (const candidate of candidates) {
    const value = (candidate || '').trim().replace(/\/+$/, '');
    if (!value) continue;
    try {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      if (url.hostname.includes('.') || url.hostname === 'localhost') return url.origin;
    } catch {
      /* try the next candidate */
    }
  }
  return 'https://flousy.app';
}

function vercelUrl(name: string): string | undefined {
  const value = process.env[name];
  return value ? `https://${value.replace(/^https?:\/\//, '')}` : undefined;
}

/**
 * Configuration probe for this deployment — sends nothing and reveals no secret.
 *
 * "The invite email didn't arrive" is almost always an environment-variable
 * question (Vercel scopes vars per environment), and the answer previously
 * required reading server logs. A client can ask instead, which is also what the
 * panel does when it wants to explain why only a code was produced.
 */
export async function GET() {
  const from = process.env.RESEND_FROM_EMAIL || 'SmartJib <onboarding@resend.dev>';
  const configured = Boolean(process.env.RESEND_API_KEY);
  return NextResponse.json({
    emailConfigured: configured,
    sandboxSender: from.includes(SANDBOX_SENDER),
    environment: isProductionDeployment() ? 'production' : process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    code: configured ? (isProductionDeployment() && from.includes(SANDBOX_SENDER) ? 'sandbox_sender' : 'ready') : 'email_not_configured',
  });
}

/** Sends a locale-aware, escaped household invitation email. */
export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'SmartJib <onboarding@resend.dev>';
  const production = isProductionDeployment();
  if (!apiKey) {
    // The invitation itself is valid and its code works; only the email is
    // unavailable. `code` lets the UI say that instead of a generic failure, and
    // the hint names the variables to set (per environment — a preview does not
    // inherit production's secrets).
    return NextResponse.json({
      error: 'Invitation email is not configured for this deployment.',
      code: 'email_not_configured',
      hint: 'Set RESEND_API_KEY (and RESEND_FROM_EMAIL) for this Vercel environment, then redeploy.',
    }, { status: 503 });
  }
  if (production && from.includes(SANDBOX_SENDER)) {
    // Fail loudly instead of "200 OK, nothing delivered": Resend only lets a
    // sandbox sender mail the address verified on the account.
    return NextResponse.json({
      error: 'Invitation sender is still the Resend sandbox address.',
      code: 'sandbox_sender',
      hint: 'Set RESEND_FROM_EMAIL to a sender on a domain verified in Resend.',
    }, { status: 503 });
  }

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json(
      { error: 'Sign in to send an invitation.', code: 'unauthorized' },
      { status: 401 },
    );
  }
  const caller = await identifyCaller(token);
  if (!isCaller(caller)) {
    const reason = caller.reason;
    if (reason === 'auth_not_configured') {
      return NextResponse.json(
        {
          error: 'This deployment cannot verify who is calling.',
          code: 'auth_not_configured',
          hint: 'Set NEXT_PUBLIC_FIREBASE_PROJECT_ID for this Vercel environment and redeploy.',
        },
        { status: 503 },
      );
    }
    const expired = reason === 'expired' || reason === 'revoked' || reason === 'not_yet_valid';
    return NextResponse.json(
      {
        error: expired
          ? 'Your session has expired. Sign in again.'
          : 'Your session could not be verified. Reload the page and try again.',
        code: expired ? 'session_expired' : 'invalid_token',
        reason,
      },
      { status: 401 },
    );
  }
  if (rateLimited(caller.uid)) {
    return NextResponse.json(
      { error: 'Too many invitations sent. Try again in a few minutes.', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': '600' } },
    );
  }

  try {
    const { inviteId, locale } = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof inviteId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(inviteId)) {
      return NextResponse.json({ error: 'Invalid invitation code.', code: 'invalid_code' }, { status: 400 });
    }

    const invite = await readDocument('householdInvites', inviteId, token);
    if (!invite || invite.createdBy !== caller.uid) {
      // Either the document is not this caller's, or it was never written: both
      // mean we must not send anything.
      return NextResponse.json({ error: 'This invitation is not available any more.', code: 'invite_not_found' }, { status: 403 });
    }
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation is no longer pending.', code: 'invite_not_pending' }, { status: 409 });
    }
    // An expired code is still readable, but mailing it would promise access the
    // client-side acceptance step then refuses.
    if (typeof invite.expiresAt === 'string' && Date.parse(invite.expiresAt) < Date.now()) {
      return NextResponse.json({ error: 'This invitation has expired.', code: 'invite_expired' }, { status: 410 });
    }

    const recipient = String(invite.email || '').trim().toLowerCase();
    const role = String(invite.role || '');
    const householdId = String(invite.householdId || '');
    // The household name comes from the document, so the only text this service
    // will put in an email body is text the caller actually stored.
    const household = householdId ? await readDocument('households', householdId, token) : null;
    const householdName = String(household?.name || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(recipient) || !INVITABLE_ROLES.includes(role as (typeof INVITABLE_ROLES)[number])) {
      return NextResponse.json({ error: 'This invitation is incomplete.', code: 'invalid_invite' }, { status: 400 });
    }

    const language: Language = locale === 'ar' || locale === 'fr' ? locale : 'en';
    const messages = EMAIL_MESSAGES[language];
    const localizedRole = messages.householdRoles[role as keyof typeof messages.householdRoles] || role;
    const emailCopy = messages.household;
    const interpolate = (template: string) =>
      formatMessage(template, { household: householdName.slice(0, 100), role: localizedRole });
    // Never trust a `Host`/origin from the request for a link that grants access:
    // `APP_URL` is deployment configuration, and the fallback is the configured
    // site rather than whatever hostname the caller sent.
    const baseUrl = resolveAppBaseUrl();
    if (!householdName) {
      return NextResponse.json({ error: 'The household for this invitation was removed.', code: 'household_missing' }, { status: 409 });
    }
    const acceptUrl = `${baseUrl}/dashboard/profile?invite=${encodeURIComponent(inviteId)}`;

    const delivery = await new Resend(apiKey).emails.send({
      from,
      to: recipient,
      subject: interpolate(emailCopy.emailSubject),
      html: `<div dir="${language === 'ar' ? 'rtl' : 'ltr'}"><p>${escapeHtml(emailCopy.emailGreeting)}</p><p>${escapeHtml(interpolate(emailCopy.emailBody))}</p><p><a href="${escapeHtml(acceptUrl)}">${escapeHtml(emailCopy.emailAccept)}</a></p><p>${escapeHtml(emailCopy.emailExpires)}</p></div>`,
      text: [
        emailCopy.emailGreeting,
        interpolate(emailCopy.emailBody),
        `${emailCopy.emailAccept}: ${acceptUrl}`,
        emailCopy.emailExpires,
      ].join('\n\n'),
    });
    if (delivery.error) {
      // Resend answers with the real reason (unverified domain, test key,
      // quota); it is logged server-side and reduced to a code for the client,
      // so no provider internals leak into the UI.
      console.error('Resend rejected the invitation email', delivery.error);
      return NextResponse.json({
        error: 'The email provider refused to deliver this invitation.',
        code: from.includes(SANDBOX_SENDER) ? 'sandbox_sender' : 'delivery_failed',
        hint: from.includes(SANDBOX_SENDER)
          ? 'This deployment is mailing from the Resend sandbox address, which only delivers to the address verified on the Resend account.'
          : undefined,
      }, { status: 502 });
    }
    return NextResponse.json({ ok: true, email: recipient });
  } catch (error) {
    console.error('Household invitation email failed', error);
    return NextResponse.json({ error: 'Unable to send invitation email.', code: 'send_failed' }, { status: 500 });
  }
}
