import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

/**
 * Configure Google Sign-In for native Android (Google Play MVP).
 * The webClientId is required for obtaining ID tokens from Google Sign-In.
 * The Android OAuth Client ID is automatically resolved from google-services.json.
 *
 * Priority:
 *   1. Explicit argument passed to this function
 *   2. EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID env var (set at build time)
 *   3. app.config.ts → extra.googleWebClientId (set via EAS env vars)
 */
const FALLBACK_WEB_CLIENT_ID =
  '636070498350-g7pjc8019fm4cggpepdvk2es3532k1b8.apps.googleusercontent.com';

export function resolveGoogleWebClientId(webClientId?: string): string {
  return (
    webClientId ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    (Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined)?.googleWebClientId ||
    FALLBACK_WEB_CLIENT_ID
  );
}

export function configureGoogleSignIn(webClientId?: string) {
  const resolvedClientId = resolveGoogleWebClientId(webClientId);
  // idToken for Firebase Auth only — offlineAccess requires a server auth code
  // and often yields "No ID token" on Android if misconfigured.
  GoogleSignin.configure({
    webClientId: resolvedClientId,
    offlineAccess: false,
  });
}

export const firebaseAuth = auth;
export const firebaseFirestore = firestore;
