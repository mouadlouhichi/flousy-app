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
import type { Firestore } from 'firebase-admin/firestore';

let app: App | null | undefined;

async function loadApp(): Promise<App | null> {
  if (app !== undefined) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    app = null;
    return app;
  }
  try {
    const credentials = JSON.parse(raw) as { project_id?: string };
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    app = getApps()[0] ?? initializeApp({
      credential: cert(credentials as Parameters<typeof cert>[0]),
      projectId: credentials.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
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

export function isAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}
