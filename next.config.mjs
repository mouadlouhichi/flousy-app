/** @type {import('next').NextConfig} */

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const FIREBASE_AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${FIREBASE_PROJECT_ID}.firebaseapp.com`;

if (!FIREBASE_AUTH_DOMAIN) {
  throw new Error(
    'Missing NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN (or NEXT_PUBLIC_FIREBASE_PROJECT_ID) — required to build the Content-Security-Policy header.'
  );
}

const csp = [
  "default-src 'self'",
  // Firebase JS SDK + Google Sign-In popup script.
  "script-src 'self' https://apis.google.com https://www.gstatic.com",
  // Google Fonts stylesheet + Tailwind's injected <style> tags need inline.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  // Firestore, Auth (identitytoolkit/securetoken), and RTDB websockets if used.
  `connect-src 'self' https://*.googleapis.com https://${FIREBASE_AUTH_DOMAIN} wss://*.firebaseio.com`,
  // Google Sign-In popup/redirect + Firebase Auth's own auth-domain iframe.
  `frame-src https://accounts.google.com https://${FIREBASE_AUTH_DOMAIN}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // stop advertising "X-Powered-By: Next.js"
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: csp },
          // Needed alongside CSP so Firebase's signInWithPopup() can still
          // talk back to the opener window; plain 'same-origin' breaks it.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;