import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account action',
  description: 'Confirm your SmartJib email address or choose a new password.',
  alternates: {
    canonical: '/auth/action',
  },
  // Email links with one-time codes should never be indexed.
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Branded Firebase Auth action handler (verify email / reset password). The
 * corresponding emails are sent from our own domain via /api/auth/email and
 * point here instead of the `<project>.firebaseapp.com` hosted handler.
 *
 * Public like any marketing page: the page calls the Firebase client SDK
 * directly and reads copy through the light language provider mounted in the
 * root layout (the full LanguageProvider requires AuthProvider). The link in
 * an email is often opened on a device where the user is not signed in, so
 * no auth state is needed here.
 */
export default function AuthActionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
