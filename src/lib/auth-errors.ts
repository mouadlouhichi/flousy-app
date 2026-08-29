/** Map Firebase Auth errors to a short message the user can act on. */
export function authErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';

  switch (code) {
    case 'auth/unauthorized-domain':
      return 'This domain is not allowed to sign in. Add it under Firebase → Authentication → Authorized domains, or use the production site.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked. Allow popups for this site, or use email login.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is disabled in Firebase.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Log in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    default:
      break;
  }

  if (/unauthorized-domain/i.test(raw)) {
    return 'This domain is not allowed to sign in. Add it under Firebase → Authentication → Authorized domains, or use the production site.';
  }
  if (/api[- ]key/i.test(raw) && /referrer|blocked/i.test(raw)) {
    return 'Firebase blocked this preview domain. Add it to the API key HTTP referrers, or use the production site.';
  }
  return raw || 'Authentication failed. Please verify credentials.';
}
