/**
 * Client half of the custom auth-mail service (server:
 * src/app/api/auth/email/route.ts).
 *
 * Every auth email SmartJib sends (password reset, email verification) tries
 * the branded Resend-backed service first so it leaves from our own domain
 * with the brand template. Deployments that have not wired that service
 * (missing RESEND_API_KEY / FIREBASE_SERVICE_ACCOUNT_JSON, or a sandbox
 * sender in production) signal it with a 503 + code, and the caller falls
 * back to Firebase Auth's built-in mailer — sign-in flows keep working in
 * previews and CI, and never pretend an email was sent when it was not.
 */

// Keep in sync with LANG_STORAGE_KEY in ./i18n.ts — inlined so importing this
// helper does not pull the message catalog into the auth bundle.
const LANGUAGE_STORAGE_KEY = 'smartjib_language';

function currentLocale(): 'en' | 'fr' | 'ar' {
  if (typeof window === 'undefined') return 'en';
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || '';
    return value === 'ar' || value === 'fr' ? value : 'en';
  } catch {
    return 'en';
  }
}

/** Error shaped like a Firebase Auth error so `authErrorMessage` maps it. */
export class AuthEmailError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthEmailError';
  }
}

export type AuthEmailKind = 'password_reset' | 'email_verification';

/**
 * Config unavailability codes: the deployment cannot send branded mail, so
 * the caller should use the built-in Firebase mailer instead.
 */
const FALLBACK_CODES = new Set(['email_not_configured', 'admin_not_configured', 'sandbox_sender', 'auth_not_configured']);

export interface AuthEmailResponse {
  error?: string;
  code?: string;
}

/**
 * Ask the server to send one branded auth email.
 *
 * Returns `true` when the email was accepted for delivery. Returns `false`
 * when the deployment is not configured for custom mail (caller falls back).
 * Throws an `AuthEmailError` for real failures (rate limit, provider refusal)
 * whose `code` mirrors Firebase's (`auth/too-many-requests`, …) so existing
 * error mapping keeps working.
 */
export async function requestAuthEmail(kind: AuthEmailKind, options: { email?: string; idToken?: string } = {}): Promise<boolean> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.idToken) headers.Authorization = `Bearer ${options.idToken}`;
  let response: Response;
  try {
    response = await fetch('/api/auth/email', {
      method: 'POST',
      headers,
      body: JSON.stringify({ kind, email: options.email, locale: currentLocale() }),
    });
  } catch {
    // Offline / DNS / CORS: let the default mailer try instead of failing the flow.
    throw new AuthEmailError('auth/network-request-failed', 'Network error reaching the email service.');
  }
  if (response.ok) {
    // `already_verified` (409) is handled below; everything 2xx is sent.
    return true;
  }
  const body = (await response.json().catch(() => ({}))) as AuthEmailResponse;
  const code = body.code || '';
  if (response.status === 503 && FALLBACK_CODES.has(code)) return false;
  if (response.status === 409 && code === 'already_verified') return true;
  if (response.status === 429) throw new AuthEmailError('auth/too-many-requests', 'Too many email requests.');
  if (response.status === 400) throw new AuthEmailError('auth/invalid-email', body.error || 'Invalid email address.');
  if (response.status === 401) {
    // The verification flow is the only authed one; let the default mailer
    // try with the live SDK session before telling the user it failed.
    return false;
  }
  throw new AuthEmailError('auth/internal-error', body.error || 'The email service failed.');
}

/**
 * Send a branded auth email, falling back to `fallback` (the Firebase default
 * mailer) when the custom service is not wired up. A real error from the
 * custom service is thrown; the fallback is NOT tried in that case, so a
 * rate limit or provider refusal is never silently repeated against a second
 * provider.
 */
export async function sendBrandedAuthEmail(kind: AuthEmailKind, options: { email?: string; idToken?: string }, fallback: () => Promise<void>): Promise<void> {
  const delivered = await requestAuthEmail(kind, options);
  if (!delivered) await fallback();
}
