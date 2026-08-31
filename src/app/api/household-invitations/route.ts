import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import en from '../../../../messages/en.json';
import fr from '../../../../messages/fr.json';
import ar from '../../../../messages/ar.json';
import { formatMessage, type Language, type Messages } from '@/lib/i18n-core';

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

/* -------------------------------------------------------------------------- */
/* Caller verification                                                         */
/* -------------------------------------------------------------------------- */

interface Caller {
  uid: string;
  email?: string;
}

/**
 * Verify the bearer ID token with the Identity Toolkit, without pulling
 * `firebase-admin` (and its service-account key) into a route that only needs to
 * know who is calling. The lookup also reflects revocation, which a pure JWT
 * signature check would not.
 */
async function verifyIdToken(token: string): Promise<Caller | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?idToken=${encodeURIComponent(token)}`,
      { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { users?: Array<{ localId: string; email?: string }> };
    const user = body.users?.[0];
    return user ? { uid: user.localId, email: user.email } : null;
  } catch {
    return null;
  }
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

/** Sends a locale-aware, escaped household invitation email. */
export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'SmartJib <onboarding@resend.dev>';
  if (!apiKey) return NextResponse.json({ error: 'Invitation email is not configured.' }, { status: 503 });
  if (process.env.NODE_ENV === 'production' && from.includes(SANDBOX_SENDER)) {
    // Fail loudly instead of "200 OK, nothing delivered".
    return NextResponse.json(
      { error: 'Invitation sender is still the Resend sandbox address; set RESEND_FROM_EMAIL.' },
      { status: 503 },
    );
  }

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'Sign in to send an invitation.' }, { status: 401 });
  const caller = await verifyIdToken(token);
  if (!caller) return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
  if (rateLimited(caller.uid)) {
    return NextResponse.json({ error: 'Too many invitations sent. Try again in a few minutes.' }, { status: 429 });
  }

  try {
    const { inviteId, locale } = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof inviteId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(inviteId)) {
      return NextResponse.json({ error: 'Invalid invitation code.' }, { status: 400 });
    }

    const invite = await readDocument('householdInvites', inviteId, token);
    if (!invite || invite.createdBy !== caller.uid) {
      // Either the document is not this caller's, or it was never written: both
      // mean we must not send anything.
      return NextResponse.json({ error: 'This invitation is not available any more.' }, { status: 403 });
    }
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation is no longer pending.' }, { status: 409 });
    }
    // An expired code is still readable, but mailing it would promise access the
    // client-side acceptance step then refuses.
    if (typeof invite.expiresAt === 'string' && Date.parse(invite.expiresAt) < Date.now()) {
      return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
    }

    const recipient = String(invite.email || '').trim().toLowerCase();
    const role = String(invite.role || '');
    const householdId = String(invite.householdId || '');
    // The household name comes from the document, so the only text this service
    // will put in an email body is text the caller actually stored.
    const household = householdId ? await readDocument('households', householdId, token) : null;
    const householdName = String(household?.name || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(recipient) || !INVITABLE_ROLES.includes(role as (typeof INVITABLE_ROLES)[number])) {
      return NextResponse.json({ error: 'This invitation is incomplete.' }, { status: 400 });
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
    const baseUrl = (process.env.APP_URL || '').replace(/\/+$/, '') || 'https://flousy.app';
    if (!householdName) {
      return NextResponse.json({ error: 'The household for this invitation was removed.' }, { status: 409 });
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
    if (delivery.error) return NextResponse.json({ error: 'Invitation delivery failed.' }, { status: 502 });
    return NextResponse.json({ ok: true, email: recipient });
  } catch (error) {
    console.error('Household invitation email failed', error);
    return NextResponse.json({ error: 'Unable to send invitation email.' }, { status: 500 });
  }
}
