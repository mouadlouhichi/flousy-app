/**
 * Firebase Admin SDK, initialised lazily and only when a service account is
 * configured. Browser routes never import this module; it exists for the
 * reminder dispatcher (needs to read every opted-in profile) and, later, for
 * billing webhooks that project entitlements.
 *
 * `FIREBASE_SERVICE_ACCOUNT_JSON` holds the full service-account JSON (as a
 * single-line string). Unset ⇒ `getAdminFirestore()` returns null and every
 * dependent route reports `not_configured` instead of failing loudly.
 */
import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

let app: App | null | undefined;

/**
 * Decode the configured service-account document.
 *
 * Two formats are accepted (both are documented in .env.example):
 * 1. raw JSON — `{ "type": "service_account", … }`, single- or multi-line;
 * 2. base64 of that JSON — the format that pastes losslessly into the Vercel
 *    env-var UI (newlines in a pasted raw value are the usual failure mode).
 * Anything else ⇒ null, and dependents report not_configured rather than
 * starting with half-valid credentials.
 */
export function parseServiceAccount(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  let text = raw.trim();
  if (!text) return null;
  if (!text.startsWith('{')) {
    try {
      text = Buffer.from(text, 'base64').toString('utf8').trim();
    } catch {
      return null;
    }
    if (!text.startsWith('{')) return null;
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function loadApp(): Promise<App | null> {
  if (app !== undefined) return app;
  const credentials = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!credentials) {
    app = null;
    return app;
  }
  try {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    app = getApps()[0] ?? initializeApp({
      credential: cert(credentials as Parameters<typeof cert>[0]),
      projectId: (credentials.project_id as string | undefined) || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } catch {
    app = null;
  }
  return app;
}

export async function getAdminFirestore(): Promise<Firestore | null> {
  const instance = await loadApp();
  if (!instance) return null;
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore(instance);
}

/**
 * Admin Auth handle. Used by /api/auth/email to mint action links (password
 * reset, email verification) that OUR mail service delivers — generating a
 * link never sends anything through Firebase's default mailer.
 */
export async function getAdminAuth(): Promise<Auth | null> {
  const instance = await loadApp();
  if (!instance) return null;
  const { getAuth } = await import('firebase-admin/auth');
  return getAuth(instance);
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}
