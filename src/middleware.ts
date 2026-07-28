import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Fresh nonce per request — this is what lets Next.js's own inline
  // hydration/streaming scripts execute without falling back to
  // 'unsafe-inline'.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' 'unsafe-inline' 'nonce-${nonce}' https://apis.google.com https://www.gstatic.com`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com https://www.gstatic.com`;

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    `connect-src 'self' https://*.googleapis.com https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN} wss://*.firebaseio.com`,
    `frame-src https://accounts.google.com https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ]
    .join('; ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    // Run on every page request so Next.js's hydration scripts get a
    // nonce; skip static assets, images, and API routes.
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};