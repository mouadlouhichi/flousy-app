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
export function configureGoogleSignIn(webClientId?: string) {
  const resolvedClientId =
    webClientId ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    (Constants.expoConfig?.extra as any)?.googleWebClientId ||
    '';

  GoogleSignin.configure({
    webClientId: resolvedClientId,
    offlineAccess: true,
  });
}

export const firebaseAuth = auth;
export const firebaseFirestore = firestore;
