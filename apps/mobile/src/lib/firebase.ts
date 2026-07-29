import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

/**
 * Configure Google Sign-In for native Android (Google Play MVP).
 * Note: webClientId is required for obtaining ID tokens from Google.
 * The Android OAuth Client ID is automatically resolved from google-services.json.
 */
export function configureGoogleSignIn(webClientId?: string) {
  GoogleSignin.configure({
    webClientId: webClientId || '',
    offlineAccess: true,
  });
}

export const firebaseAuth = auth;
export const firebaseFirestore = firestore;
