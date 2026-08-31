/**
 * Guards for the hardening work: header policy, the abuse limits on the two
 * server endpoints, the consent gate in front of analytics, and the "did the
 * erasure actually happen" contract around account deletion.
 *
 * These read source text on purpose, like the rest of this suite: the behaviours
 * they pin live in browser/edge runtime paths (a CSP header, a fetch that must
 * not happen) that a unit test with stubs would only re-assert its own mocks.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, new URL('../', import.meta.url)), 'utf8');

describe('response headers', () => {
  const config = read('next.config.mjs');
  const middleware = read('src/middleware.ts');

  it('keeps the clickjacking and sniffing defaults on every route', () => {
    assert.match(config, /X-Content-Type-Options', value: 'nosniff'/);
    assert.match(config, /Referrer-Policy', value: 'strict-origin-when-cross-origin'/);
    assert.match(config, /Strict-Transport-Security', value: 'max-age=\d+; includeSubDomains; preload'/);
  });

  it('allows the camera but not the microphone or geolocation', () => {
    // `camera=()` was the original value and it disabled the barcode scanner
    // outright, so the policy must keep the camera for this origin.
    const policy = /Permissions-Policy', value: '([^']+)'/.exec(config)?.[1] ?? '';
    assert.match(policy, /camera=\(self\)/);
    assert.match(policy, /microphone=\(\)/);
    assert.match(policy, /geolocation=\(\)/);
  });

  it('seals framing in production while Google sign-in popups stay allowed', () => {
    assert.match(middleware, /frame-ancestors 'none'/);
    assert.match(config, /Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups'/);
  });

  it('applies CSP to /api responses as well as pages', () => {
    // The matcher used to exclude /api, leaving JSON responses as the one place
    // with no policy at all.
    assert.doesNotMatch(middleware, /source: '\/api'/);
    assert.match(middleware, /const apiRoute = pathname === '\/api' \|\| pathname\.startsWith\('\/api\/'\)/);
    assert.match(middleware, /response\.headers\.set\('Content-Security-Policy', csp\)/);
    assert.match(middleware, /Cache-Control', 'no-store, max-age=0'/);
  });

  it('does not let a prerendered app shell be cached by a shared CDN', () => {
    assert.match(middleware, /private, no-store, max-age=0/);
    // A service worker left in an immutable cache strands users on old builds.
    assert.match(middleware, /public, max-age=0, must-revalidate/);
  });
});

describe('server endpoint abuse limits', () => {
  const invitations = read('src/app/api/household-invitations/route.ts');
  const barcode = read('src/app/api/barcode/lookup/route.ts');

  it('requires a signed-in caller before mailing an invitation', () => {
    assert.match(invitations, /accounts:lookup\?idToken=/);
    assert.match(invitations, /status: 401/);
    assert.match(invitations, /Authorization: `Bearer \$\{token\}`/);
    // The recipient address must come from the stored invitation, never from the
    // request body, or this becomes an open mail relay.
    assert.match(invitations, /invite\.createdBy !== caller\.uid/);
    assert.match(invitations, /String\(invite\.email/);
    assert.doesNotMatch(invitations, /const \{ email, householdName, role \} = await request\.json/);
  });

  it('refuses the Resend sandbox sender in production', () => {
    assert.match(invitations, /NODE_ENV === 'production'/);
    assert.match(invitations, /@resend\.dev/);
  });

  it('rate limits sends per user', () => {
    assert.match(invitations, /rateLimited\(/);
    assert.match(invitations, /status: 429/);
  });

  it('validates the barcode argument and bounds the outbound fan-out', () => {
    assert.match(barcode, /\/\^\[0-9\]\{8\}\$\//);
    assert.match(barcode, /\/\^\[0-9\]\{13\}\$\//);
    assert.match(barcode, /AbortSignal\.timeout\(/);
    // A per-IP budget is what stops this being a free proxy against Open Food
    // Facts; without it one client can occupy five upstream fetches per request.
    assert.match(barcode, /status: 429/);
  });
});

describe('analytics consent', () => {
  const analytics = read('src/lib/analytics.ts');

  it('loads nothing and sends nothing until the user agrees', () => {
    assert.match(analytics, /export const CONSENT_STORAGE_KEY/);
    assert.match(analytics, /function analyticsConsented\(\)/);
    // Both entry points must consult it: the loader (module import) and the
    // event call itself (a provider configured by env alone is not consent).
    assert.match(analytics, /if \(!analyticsConsented\(\)\) return null;/);
    assert.match(analytics, /if \(!analyticsConsented\(\)\) return;/);
    assert.match(analytics, /localStorage\.getItem\(CONSENT_STORAGE_KEY\) === 'granted'/);
  });

  it('records an explicit choice rather than defaulting to tracked', () => {
    const shell = read('src/components/dashboard/dashboard-shell.tsx');
    const preferences = read('src/components/dashboard/profile/preferences-panel.tsx');
    assert.match(shell, /AnalyticsConsentPrompt/);
    assert.match(preferences, /AnalyticsConsentToggle/);
  });
});

describe('destructive account operations', () => {
  const auth = read('src/lib/auth-context.tsx');
  const accountPanel = read('src/components/dashboard/profile/account-panel.tsx');
  const db = read('src/lib/db.ts');

  it('re-authenticates before deleting an account', () => {
    assert.match(auth, /reauthenticateWithCredential/);
    assert.match(auth, /EmailAuthProvider\.credential/);
    assert.match(auth, /class RequiresRecentLoginError/);
    assert.match(accountPanel, /RequiresRecentLoginError/);
    assert.match(accountPanel, /m\.auth\.confirmPasswordTitle/);
  });

  it('never reports success for a partial erasure', () => {
    assert.match(db, /export interface DeletionReport/);
    assert.match(auth, /class AccountDeletionIncompleteError/);
    assert.match(auth, /throw new AccountDeletionIncompleteError\(report\)/);
    assert.match(accountPanel, /AccountDeletionIncompleteError/);
    // Deleting the Firebase user before the data is gone would orphan whatever
    // failed: nothing else could reach those documents again.
    const deleteOrder = auth.indexOf('AccountDeletionIncompleteError(report)');
    const userDelete = auth.indexOf('await deleteUser(user)');
    assert.ok(deleteOrder > -1 && userDelete > deleteOrder, 'data must be erased before the account');
  });

  it('keeps household data reachable while its owner account still exists', () => {
    // The wipe order matters: a household document is resolved through the
    // owner's profile for the Pro check, so households go first.
    assert.match(db, /async function deleteUserAccountData/);
    assert.match(db, /householdIds/);
  });
});

describe('canonical origin', () => {
  const seo = read('src/lib/seo.ts');
  const landing = read('src/app/page.tsx');

  it('follows the deployed origin instead of hard-coding production', () => {
    assert.match(seo, /NEXT_PUBLIC_SITE_URL/);
    // A malformed value must fall back rather than be emitted into `canonical`.
    assert.match(seo, /catch \{\s*return fallback;/);
  });

  it('does not advertise locale URLs that are not routed', () => {
    assert.doesNotMatch(landing, /'\/fr'/);
    assert.doesNotMatch(landing, /'\/ar'/);
    assert.match(landing, /canonical: '\/'/);
  });
});
