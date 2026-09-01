/** Copy needed to describe Firebase authentication failures without exposing raw SDK text. */
export type AuthErrorCopy = {
  unauthorizedDomain: string;
  invalidCredentials: string;
  tooManyAttempts: string;
  popupBlocked: string;
  signInCancelled: string;
  networkError: string;
  signInMethodDisabled: string;
  emailAlreadyInUse: string;
  weakPassword: string;
  apiKeyReferrerBlocked: string;
  authFailed: string;
};

const DEFAULT_AUTH_ERROR_COPY: AuthErrorCopy = {
  unauthorizedDomain:
    'This domain is not allowed to sign in. Add it under Firebase → Authentication → Authorized domains, or use the production site.',
  invalidCredentials: 'Email or password is incorrect.',
  tooManyAttempts: 'Too many attempts. Wait a few minutes and try again.',
  popupBlocked: 'The sign-in popup was blocked. Allow popups for this site, or use email login.',
  signInCancelled: 'Sign-in was cancelled.',
  networkError: 'Network error. Check your connection and try again.',
  signInMethodDisabled: 'This sign-in method is disabled in Firebase.',
  emailAlreadyInUse: 'An account with this email already exists. Log in instead.',
  weakPassword: 'Password must be at least 6 characters.',
  apiKeyReferrerBlocked:
    'Firebase blocked this preview domain. Add it to the API key HTTP referrers, or use the production site.',
  authFailed: 'Authentication failed. Please verify credentials.',
};

/** Map Firebase Auth errors to localized, actionable messages. */
export function authErrorMessage(err: unknown, copy: AuthErrorCopy = DEFAULT_AUTH_ERROR_COPY): string {
  const code =
    typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';

  switch (code) {
    case 'auth/unauthorized-domain':
      return copy.unauthorizedDomain;
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return copy.invalidCredentials;
    case 'auth/too-many-requests':
      return copy.tooManyAttempts;
    case 'auth/popup-blocked':
      return copy.popupBlocked;
    case 'auth/popup-closed-by-user':
      return copy.signInCancelled;
    case 'auth/network-request-failed':
      return copy.networkError;
    case 'auth/operation-not-allowed':
      return copy.signInMethodDisabled;
    case 'auth/email-already-in-use':
      return copy.emailAlreadyInUse;
    case 'auth/weak-password':
      return copy.weakPassword;
    default:
      break;
  }

  if (/unauthorized-domain/i.test(raw)) return copy.unauthorizedDomain;
  if (/api[- ]key/i.test(raw) && /referrer|blocked/i.test(raw)) return copy.apiKeyReferrerBlocked;
  return copy.authFailed;
}
