import * as Linking from 'expo-linking';

/**
 * Build the deep link prefix for SmartJib.
 * Matches the "scheme" in app.config.ts → "flousy"
 */
export const SMARTJIB_DEEP_LINK_PREFIX = 'smartjib://';

/**
 * Common deep link paths used by the app.
 */
export const DEEP_LINKS = {
  /** Firebase email verification / password reset */
  authAction: '/auth/action',
  /** Dashboard after login */
  dashboard: '/dashboard',
  /** Onboarding */
  onboarding: '/onboarding',
} as const;

/**
 * Extract the continueUrl or oobCode from a Firebase auth deep link.
 * Firebase sends links like: https://your-project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=XXX
 *
 * On Android, these are intercepted by the Firebase SDK automatically
 * when google-services.json is configured. This utility is for
 * custom deep link handling if needed.
 */
export function parseFirebaseAuthLink(url: string): {
  mode: string | null;
  oobCode: string | null;
  continueUrl: string | null;
} {
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get('mode');
    const oobCode = parsed.searchParams.get('oobCode');
    const continueUrl = parsed.searchParams.get('continueUrl');
    return { mode, oobCode, continueUrl };
  } catch {
    return { mode: null, oobCode: null, continueUrl: null };
  }
}

/**
 * Get the app's redirect URI for OAuth flows.
 * Uses the custom scheme defined in app.config.ts.
 */
export function getRedirectUri(): string {
  return Linking.createURL('auth/action');
}
