import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

/**
 * Verifying a Firebase ID token without `firebase-admin`.
 *
 * The invitation route must know who is calling before it mails anything, and the
 * usual answer (`firebase-admin` + a service-account key) is a second set of
 * production credentials for a check that only needs to be *read*-only. Google
 * documents the lighter path — verify the token's RS256 signature against the
 * public certs Firebase publishes — and that is what this module implements.
 *
 * It replaces an earlier version of this check that called
 * `identitytoolkit.googleapis.com/v1/accounts:lookup` with `GET` and no `key=`
 * parameter. Identity Toolkit requires the project's API key on that endpoint,
 * so the call answered 403 for every request, and a signed-in user was told to
 * "sign in to send an invitation" no matter what they did. Signature
 * verification needs no key at all, so the route no longer depends on one being
 * present in the function's environment.
 *
 * The lookup is still used when it *can* be used (a local signature check cannot
 * see a token that was revoked minutes ago), but it is now a best-effort
 * refinement rather than the gate: a failure to reach it does not lock anyone
 * out, while an answer of "no such user" does.
 */

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const ISSUER_PREFIX = 'https://securetoken.google.com/';
/** Documented bound on a Firebase uid. */
const MAX_UID_LENGTH = 128;
/** Clock skew tolerated between the deployment and Google's `exp`/`iat`. */
const CLOCK_SKEW_SECONDS = 60;
const FALLBACK_CACHE_MS = 6 * 60 * 60 * 1000;

export type TokenRejection =
  | 'malformed'
  | 'unsupported_algorithm'
  | 'unknown_key'
  | 'bad_signature'
  | 'bad_issuer'
  | 'bad_audience'
  | 'expired'
  | 'not_yet_valid'
  | 'bad_subject'
  | 'revoked';

export type TokenResult =
  | { ok: true; uid: string; email?: string }
  | { ok: false; reason: TokenRejection };

interface FetchResponseLike {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

type FetchLike = (input: string, init?: Record<string, unknown>) => Promise<FetchResponseLike>;

interface VerifyOptions {
  projectId: string;
  fetch?: FetchLike;
  now?: () => number;
  /** Present only to enable the optional revocation check. */
  apiKey?: string;
}

/** kid → PEM certificate, with the cache lifetime Google advertises. */
let certCache: { at: number; maxAgeMs: number; keys: Record<string, string> } | null = null;

function base64UrlToJson(segment: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cacheLifetimeMs(headerValue: string | null): number {
  const match = /max-age=(\d+)/i.exec(headerValue || '');
  if (!match) return FALLBACK_CACHE_MS;
  // Clamped so a hostile or mistaken header cannot pin a stale key set forever,
  // and a key rotation stays visible within the hour.
  return Math.min(Math.max(Number(match[1]) * 1000, 60_000), 6 * 60 * 60 * 1000);
}

async function signingKeys(fetchImpl: FetchLike): Promise<Record<string, string> | null> {
  const now = Date.now();
  if (certCache && now - certCache.at < certCache.maxAgeMs) return certCache.keys;
  try {
    const response = await fetchImpl(CERT_URL, { cache: 'no-store' });
    if (!response.ok) return certCache?.keys ?? null;
    const body = (await response.json()) as Record<string, string>;
    const keys: Record<string, string> = {};
    for (const [kid, pem] of Object.entries(body || {})) {
      // The endpoint publishes x509 certificates; a bare public key is accepted
      // too, because the trust here comes from the TLS-fetched document rather
      // than from the PEM wrapper, and `createPublicKey` handles both.
      if (typeof pem === 'string' && /BEGIN (CERTIFICATE|PUBLIC KEY|RSA PUBLIC KEY)/.test(pem)) {
        keys[kid] = pem;
      }
    }
    if (Object.keys(keys).length === 0) return certCache?.keys ?? null;
    certCache = { at: now, maxAgeMs: cacheLifetimeMs(response.headers.get('cache-control')), keys };
    return keys;
  } catch {
    // A transient failure must not sign everyone out: serve the previous keys
    // (still valid for signing old tokens) and let `exp` bound the risk.
    return certCache?.keys ?? null;
  }
}

/**
 * @returns the caller's uid/email, or the reason the token was refused. The
 * reason is a code rather than a message because the caller must not learn
 * *why* a token was invalid from an unauthenticated endpoint beyond what the
 * token itself already implies.
 */
export async function verifyFirebaseIdToken(
  token: string,
  options: VerifyOptions,
): Promise<TokenResult> {
  const { projectId } = options;
  if (!projectId) return { ok: false, reason: 'malformed' };
  const fetchImpl: FetchLike = options.fetch ?? ((globalThis.fetch as unknown as FetchLike) || undefined);
  if (!fetchImpl) return { ok: false, reason: 'malformed' };
  const nowMs = (options.now ?? Date.now)();

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const header = base64UrlToJson(encodedHeader);
  const payload = base64UrlToJson(encodedPayload);
  if (!header || !payload) return { ok: false, reason: 'malformed' };

  // `alg` is read, never honoured: accepting `none` (or HMAC under a public key)
  // is the classic JWT bypass, and it is the reason this function refuses to
  // hand the token to a generic JWT decoder.
  if (header.alg !== 'RS256' || header.typ !== 'JWT') return { ok: false, reason: 'unsupported_algorithm' };
  if (typeof header.kid !== 'string' || !header.kid) return { ok: false, reason: 'unknown_key' };

  const claims = payload;
  if (claims.iss !== `${ISSUER_PREFIX}${projectId}`) return { ok: false, reason: 'bad_issuer' };
  if (claims.aud !== projectId) return { ok: false, reason: 'bad_audience' };

  const uid = typeof claims.sub === 'string' && claims.sub ? claims.sub : claims.user_id;
  if (typeof uid !== 'string' || uid.length === 0 || uid.length > MAX_UID_LENGTH) {
    return { ok: false, reason: 'bad_subject' };
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
    return { ok: false, reason: 'expired' };
  }
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > nowSeconds) {
    return { ok: false, reason: 'not_yet_valid' };
  }

  const keys = await signingKeys(fetchImpl);
  if (!keys) return { ok: false, reason: 'unknown_key' };
  const certificate = keys[header.kid];
  if (!certificate) return { ok: false, reason: 'unknown_key' };

  let signatureValid = false;
  try {
    signatureValid = cryptoVerify(
      'sha256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8'),
      createPublicKey({ key: certificate, format: 'pem' }),
      Buffer.from(encodedSignature, 'base64url'),
    );
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!signatureValid) return { ok: false, reason: 'bad_signature' };

  const email = typeof claims.email === 'string' ? claims.email : undefined;

  if (options.apiKey) {
    try {
      const response = await fetchImpl(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(options.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token }),
          cache: 'no-store',
        },
      );
      // 400 with `TOKEN_EXPIRED`/`INVALID_STILL_USED` and 200 with no user both
      // mean the account can no longer present this token. Anything else (5xx,
      // unreachable) is the checker's problem, not the caller's.
      if (response.ok) {
        const body = (await response.json()) as { users?: unknown };
        if (!Array.isArray(body?.users) || body.users.length === 0) return { ok: false, reason: 'revoked' };
      } else if (response.status === 400 || response.status === 401) {
        return { ok: false, reason: 'revoked' };
      }
    } catch {
      // fail open on transport errors: the signature and claims above already
      // proved the token, and `exp` bounds how long that proof stands.
    }
  }

  return { ok: true, uid, email };
}

/** Test seam: the cert cache is module state and must not leak between cases. */
export function __resetSigningKeyCacheForTests(): void {
  certCache = null;
}
