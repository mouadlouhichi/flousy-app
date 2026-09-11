import { NextRequest, NextResponse } from 'next/server';
import en from '../../../../../messages/en.json';
import fr from '../../../../../messages/fr.json';
import ar from '../../../../../messages/ar.json';
import { formatMessage, type Language, type Messages } from '@/lib/i18n-core';
import { verifyFirebaseIdToken, type TokenRejection } from '@/lib/firebase-id-token';
import { getAdminAuth, isAdminConfigured } from '@/lib/server/firebase-admin';
import { isRateLimited } from '@/lib/server/rate-limit';
import { checkArcjet } from '@/lib/server/arcjet';
import {
  fingerprint,
  isEmailConfigured,
  isProductionDeployment,
  isSandboxSender,
  renderBrandedEmail,
  resolveAppBaseUrl,
  resolveSender,
  sendEmail,
} from '@/lib/server/email';

export const runtime = 'nodejs';

const EMAIL_MESSAGES: Record<Language, Messages> = { en, fr, ar };

/**
 * Auth email service — password reset + email verification delivered through
 * Resend from our own domain, with the branded template, instead of Firebase
 * Auth's default `noreply@<project>.firebaseapp.com` mailer.
 *
 * How: the Admin SDK mints the out-of-band (oob) action link WITHOUT sending
 * anything (`generatePasswordResetLink` / `generateEmailVerificationLink`).
 * The hosted handler URL is then rewritten to our own branded action page
 * (`/auth/action?mode=…&oobCode=…`) which applies the code with the client
 * SDK — so the whole journey, inbox to confirmation screen, stays on-brand.
 *
 * Why the fallbacks exist: a deployment that has not wired RESEND_API_KEY or
 * FIREBASE_SERVICE_ACCOUNT_JSON answers 503 with an explicit code, and the
 * client falls back to the Firebase default mailer. Sign-in flows then keep
 * working in previews/CI while production mail looks right once configured.
 */

/* -------------------------------------------------------------------------- */
/* Config gating                                                               */
/* -------------------------------------------------------------------------- */

type ConfigBlocker = 'email_not_configured' | 'admin_not_configured' | 'sandbox_sender' | null;

function configBlocker(): ConfigBlocker {
  if (!isEmailConfigured()) return 'email_not_configured';
  if (!isAdminConfigured()) return 'admin_not_configured';
  // The sandbox sender never reaches real recipients in production; say so
  // loudly instead of "200 OK, nothing delivered".
  if (isProductionDeployment() && isSandboxSender(resolveSender('auth'))) return 'sandbox_sender';
  return null;
}

function configErrorResponse(code: Exclude<ConfigBlocker, null>) {
  const hints: Record<string, string> = {
    email_not_configured: 'Set RESEND_API_KEY for this environment, or the client uses the built-in Firebase mailer.',
    admin_not_configured: 'Set FIREBASE_SERVICE_ACCOUNT_JSON so the server can mint action links.',
    sandbox_sender: 'Set RESEND_AUTH_FROM_EMAIL/RESEND_FROM_EMAIL to a sender on a domain verified in Resend.',
  };
  return NextResponse.json(
    { error: 'Custom auth email is not configured for this deployment.', code, hint: hints[code] },
    { status: 503 },
  );
}

/**
 * Configuration probe — sends nothing and reveals no secret. Lets support (or
 * the settings UI) answer "why did my reset mail come from firebaseapp.com?"
 * without reading server logs.
 */
export async function GET() {
  const code = configBlocker();
  return NextResponse.json({
    emailConfigured: isEmailConfigured(),
    adminConfigured: isAdminConfigured(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    code: code ?? 'ready',
  });
}

/* -------------------------------------------------------------------------- */
/* Callers & abuse limits                                                      */
/* -------------------------------------------------------------------------- */

const WINDOW_MS = 10 * 60 * 1000;
/** Signed-in verification resends per account. */
const MAX_VERIFY_PER_WINDOW = 3;
/** Reset mails per address AND per source IP (guess-a-stranger protection). */
const MAX_RESET_PER_WINDOW = 4;
const MAX_RESET_PER_IP = 12;

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
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  });
  if ('uid' in result) return { uid: result.uid, email: result.email };
  return { reason: result.reason };
}

function clientIp(request: NextRequest): string {
  return (
    (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/* -------------------------------------------------------------------------- */
/* Action links                                                                */
/* -------------------------------------------------------------------------- */

type ActionMode = 'resetPassword' | 'verifyEmail';

/**
 * Rewrite Firebase's hosted handler link (`<project>.firebaseapp.com/__/auth/
 * action?…`) to our branded handler page. Only the `mode` and `oobCode` are
 * carried over — exactly the parameters the page needs to apply the code.
 */
function toBrandedActionLink(generatedLink: string, expectedMode: ActionMode, baseUrl: string): string | null {
  try {
    const url = new URL(generatedLink);
    const mode = url.searchParams.get('mode') || '';
    const oobCode = url.searchParams.get('oobCode') || '';
    if (mode !== expectedMode || !oobCode) return null;
    return `${baseUrl}/auth/action?mode=${encodeURIComponent(mode)}&oobCode=${encodeURIComponent(oobCode)}`;
  } catch {
    return null;
  }
}

function normalizeLocale(value: unknown): Language {
  return value === 'ar' || value === 'fr' ? value : 'en';
}

/* -------------------------------------------------------------------------- */
/* Senders                                                                     */
/* -------------------------------------------------------------------------- */

async function sendPasswordReset(email: string, locale: Language): Promise<NextResponse> {
  const auth = await getAdminAuth();
  if (!auth) return configErrorResponse('admin_not_configured');

  let link: string;
  try {
    link = await auth.generatePasswordResetLink(email);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
      // Anti-enumeration: a reset request for an unknown address looks exactly
      // like a sent one, but nothing leaves our domain.
      return NextResponse.json({ ok: true });
    }
    console.error('Password reset link generation failed', error);
    return NextResponse.json(
      { error: 'Unable to create a reset link right now. Try again shortly.', code: 'link_failed' },
      { status: 502 },
    );
  }
  const actionUrl = toBrandedActionLink(link, 'resetPassword', resolveAppBaseUrl());
  if (!actionUrl) {
    return NextResponse.json({ error: 'Unable to create a reset link right now.', code: 'link_failed' }, { status: 502 });
  }

  const m = EMAIL_MESSAGES[locale];
  const copy = m.emails;
  const appName = m.common.appName;
  const baseUrl = resolveAppBaseUrl();
  const { html, text } = renderBrandedEmail({
    language: locale,
    preheader: formatMessage(copy.resetPreheader, { appName }),
    title: formatMessage(copy.resetTitle, { appName }),
    greeting: copy.resetGreeting,
    paragraphs: [formatMessage(copy.resetBody, { email, appName }), copy.resetInstructions],
    highlight: { label: copy.accountLabel, value: email },
    cta: { label: copy.resetCta, url: actionUrl },
    fallbackLinkCaption: copy.fallbackLinkCaption,
    securityNote: formatMessage(copy.resetSecurityNote, { appName }),
    automatedNotice: formatMessage(copy.automatedNotice, { appName }),
    logoUrl: `${baseUrl}/logo-256.png`,
    brandName: appName,
    siteUrl: baseUrl,
  });

  const result = await sendEmail({
    from: resolveSender('auth'),
    to: email,
    subject: formatMessage(copy.resetSubject, { appName }),
    html,
    text,
    // The oob code uniquely identifies this logical send; provider-level
    // idempotency dedupes retries across instances and network timeouts.
    idempotencyKey: `auth-reset-${fingerprint(actionUrl)}`,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: 'The email provider refused to deliver this message.', code: 'delivery_failed' },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}

async function sendEmailVerification(caller: Caller, locale: Language): Promise<NextResponse> {
  const email = (caller.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: 'This account has no email address to verify.', code: 'no_email' },
      { status: 400 },
    );
  }
  const auth = await getAdminAuth();
  if (!auth) return configErrorResponse('admin_not_configured');

  try {
    const record = await auth.getUser(caller.uid);
    if (record.emailVerified) {
      return NextResponse.json(
        { error: 'This email address is already verified.', code: 'already_verified' },
        { status: 409 },
      );
    }
  } catch (error) {
    console.error('Could not read the user record for verification email', error);
    return NextResponse.json({ error: 'Unable to send a verification email right now.', code: 'user_lookup_failed' }, { status: 502 });
  }

  let link: string;
  try {
    link = await auth.generateEmailVerificationLink(email);
  } catch (error) {
    console.error('Verification link generation failed', error);
    return NextResponse.json(
      { error: 'Unable to create a verification link right now. Try again shortly.', code: 'link_failed' },
      { status: 502 },
    );
  }
  const actionUrl = toBrandedActionLink(link, 'verifyEmail', resolveAppBaseUrl());
  if (!actionUrl) {
    return NextResponse.json({ error: 'Unable to create a verification link right now.', code: 'link_failed' }, { status: 502 });
  }

  const m = EMAIL_MESSAGES[locale];
  const copy = m.emails;
  const appName = m.common.appName;
  const baseUrl = resolveAppBaseUrl();
  const { html, text } = renderBrandedEmail({
    language: locale,
    preheader: formatMessage(copy.verifyPreheader, { appName }),
    title: formatMessage(copy.verifyTitle, { appName }),
    greeting: copy.verifyGreeting,
    paragraphs: [formatMessage(copy.verifyBody, { email, appName }), copy.verifyInstructions],
    highlight: { label: copy.accountLabel, value: email },
    cta: { label: copy.verifyCta, url: actionUrl },
    fallbackLinkCaption: copy.fallbackLinkCaption,
    securityNote: formatMessage(copy.verifySecurityNote, { appName }),
    automatedNotice: formatMessage(copy.automatedNotice, { appName }),
    logoUrl: `${baseUrl}/logo-256.png`,
    brandName: appName,
    siteUrl: baseUrl,
  });

  const result = await sendEmail({
    from: resolveSender('auth'),
    to: email,
    subject: formatMessage(copy.verifySubject, { appName }),
    html,
    text,
    idempotencyKey: `auth-verify-${fingerprint(actionUrl)}`,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: 'The email provider refused to deliver this message.', code: 'delivery_failed' },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = body.kind;
  const locale = normalizeLocale(body.locale);

  if (kind !== 'password_reset' && kind !== 'email_verification') {
    return NextResponse.json({ error: 'Unknown email request.', code: 'invalid_kind' }, { status: 400 });
  }

  // Configuration first: the client uses these codes to decide it should fall
  // back to Firebase's default mailer instead of failing the sign-in flow.
  const blocker = configBlocker();
  if (blocker) return configErrorResponse(blocker);

  if ((await checkArcjet(request)).denied) {
    return NextResponse.json({ error: 'Request blocked.', code: 'blocked' }, { status: 403 });
  }

  if (kind === 'password_reset') {
    const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.', code: 'invalid_email' }, { status: 400 });
    }
    // Public endpoint (it's the "Forgot password?" flow) → it must defend
    // itself: limit per address AND per source IP, and never reveal via the
    // response whether the address maps to an account.
    const ip = clientIp(request);
    if (await isRateLimited('auth-email-reset', email, MAX_RESET_PER_WINDOW, WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Too many reset requests. Try again in a few minutes.', code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '600' } },
      );
    }
    if (await isRateLimited('auth-email-reset-ip', ip, MAX_RESET_PER_IP, WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Too many reset requests. Try again in a few minutes.', code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '600' } },
      );
    }
    return sendPasswordReset(email, locale);
  }

  // kind === 'email_verification' — proving who is calling is mandatory, and
  // the address comes from the verified token, never from the request body.
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Sign in to resend a verification email.', code: 'unauthorized' }, { status: 401 });
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
        error: expired ? 'Your session has expired. Sign in again.' : 'Your session could not be verified. Reload the page and try again.',
        code: expired ? 'session_expired' : 'invalid_token',
        reason,
      },
      { status: 401 },
    );
  }
  if (await isRateLimited('auth-email-verify', caller.uid, MAX_VERIFY_PER_WINDOW, WINDOW_MS)) {
    return NextResponse.json(
      { error: 'Too many verification emails requested. Try again in a few minutes.', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': '600' } },
    );
  }
  return sendEmailVerification(caller, locale);
}
