/**
 * Firebase ID-token verification.
 *
 * This exists because the first version of the check called Identity Toolkit
 * with `GET` and no API key, so **every** request failed verification and a
 * logged-in user was told to sign in. A verifier that is only exercised through
 * a live deployment cannot catch that class of bug, so these tests mint real
 * RSA-signed tokens and drive the module with a fake network.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import {
  __resetSigningKeyCacheForTests,
  verifyFirebaseIdToken,
  type TokenResult,
} from '../src/lib/firebase-id-token';

const PROJECT_ID = 'test-project';
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const KID = 'key-1';

const b64url = (value: string) => Buffer.from(value, 'utf8').toString('base64url');

function makeToken(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  sign = true,
): string {
  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(payload));
  const body = `${encodedHeader}.${encodedPayload}`;
  const signature = sign
    ? createSign('RSA-SHA256')
        .update(body)
        .sign(privateKey)
        .toString('base64url')
    : b64url('not-a-signature');
  return `${body}.${signature}`;
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    iss: ISSUER,
    aud: PROJECT_ID,
    sub: 'user-abc-123',
    email: 'member@example.com',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
    firebase: { sign_in_provider: 'password' },
    ...overrides,
  };
}

interface NetworkOptions {
  certs?: Record<string, string> | null;
  lookup?: { ok: boolean; status?: number; body?: unknown } | null;
  throwOnCerts?: boolean;
}

/**
 * Records the calls made, so the assertions cover the *shape* of the requests
 * too: certificate fetch with no key, and lookup as POST with `key=`.
 */
function fakeNetwork(options: NetworkOptions = {}) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchImpl = async (url: string, init?: Record<string, unknown>) => {
    const method = String(init?.method ?? 'GET');
    calls.push({ url, method, body: init?.body });
    if (url.includes('robot/v1/metadata/x509')) {
      if (options.throwOnCerts) throw new Error('network down');
      const certs = options.certs === undefined ? { [KID]: publicKey } : options.certs;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'public, max-age=1800' },
        json: async () => certs,
      };
    }
    if (url.includes('accounts:lookup')) {
      const lookup = options.lookup ?? { ok: true, body: { users: [{ localId: 'user-abc-123' }] } };
      if (lookup === null) throw new Error('lookup unreachable');
      return {
        ok: lookup.ok,
        status: lookup.status ?? (lookup.ok ? 200 : 403),
        headers: { get: () => null },
        json: async () => lookup.body,
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { fetchImpl: fetchImpl as never, calls };
}

async function verify(token: string, network: ReturnType<typeof fakeNetwork>, apiKey?: string): Promise<TokenResult> {
  return verifyFirebaseIdToken(token, { projectId: PROJECT_ID, fetch: network.fetchImpl, apiKey });
}

describe('Firebase ID token verification', () => {
  const validHeader = { alg: 'RS256', typ: 'JWT', kid: KID };

  it('accepts a token signed by the published key', async () => {
    __resetSigningKeyCacheForTests();
    const network = fakeNetwork();
    const result = await verify(makeToken(validHeader, claims()), network);
    assert.deepEqual(result, { ok: true, uid: 'user-abc-123', email: 'member@example.com' });
    assert.equal(
      network.calls.filter((call) => call.url.includes('robot/v1/metadata')).length,
      1,
      'the certificate set should be fetched once',
    );
  });

  it('refuses the shapes that make hand-rolled JWT checks unsafe', async () => {
    __resetSigningKeyCacheForTests();
    const network = fakeNetwork();

    // The `alg: none` and HMAC-confusion attacks both rely on a decoder that
    // picks its verification mode from the token, so the refusal is the defence.
    const none = await verify(makeToken({ alg: 'none', typ: 'JWT', kid: KID }, claims(), false), network);
    assert.deepEqual(none, { ok: false, reason: 'unsupported_algorithm' });

    const hs256 = await verify(makeToken({ alg: 'HS256', typ: 'JWT', kid: KID }, claims(), false), network);
    assert.deepEqual(hs256, { ok: false, reason: 'unsupported_algorithm' });

    // Swap the payload for one that escalates the subject while keeping the
    // signature from a legitimate token — the shape of an attacker editing a
    // captured token in transit. (Re-signing different claims with our own test
    // key would be a *valid* token, not a tampered one.)
    const legitimate = makeToken(validHeader, claims());
    const [headerPart, , signaturePart] = legitimate.split('.');
    const escalated = `${headerPart}.${b64url(
      JSON.stringify(claims({ sub: 'attacker', email: 'attacker@example.com' })),
    )}.${signaturePart}`;
    const tampered = await verify(escalated, fakeNetwork({ certs: { [KID]: publicKey } }));
    assert.equal(tampered.ok, false);
    assert.equal((tampered as { reason: string }).reason, 'bad_signature');

    const unknownKid = await verify(
      makeToken({ ...validHeader, kid: 'rotated-away' }, claims()),
      fakeNetwork(),
    );
    assert.deepEqual(unknownKid, { ok: false, reason: 'unknown_key' });
  });

  it('binds the token to this project', async () => {
    __resetSigningKeyCacheForTests();
    // Without these two checks any Firebase project's users could be treated as
    // ours — a valid signature proves nothing about who issued the token.
    const otherIssuer = await verify(
      makeToken(validHeader, claims({ iss: 'https://securetoken.google.com/someone-elses-project' })),
      fakeNetwork(),
    );
    assert.equal((otherIssuer as { reason: string }).reason, 'bad_issuer');

    const otherAudience = await verify(
      makeToken(validHeader, claims({ aud: 'someone-elses-project' })),
      fakeNetwork(),
    );
    assert.equal((otherAudience as { reason: string }).reason, 'bad_audience');
  });

  it('honours the time window and the subject', async () => {
    __resetSigningKeyCacheForTests();
    const past = Math.floor(Date.now() / 1000) - 7200;

    const expired = await verify(makeToken(validHeader, claims({ exp: past })), fakeNetwork());
    assert.equal((expired as { reason: string }).reason, 'expired');

    const future = await verify(
      makeToken(validHeader, claims({ iat: Math.floor(Date.now() / 1000) + 3600 })),
      fakeNetwork(),
    );
    assert.equal((future as { reason: string }).reason, 'not_yet_valid');

    const noSubject = await verify(makeToken(validHeader, claims({ sub: '', user_id: undefined })), fakeNetwork());
    assert.equal((noSubject as { reason: string }).reason, 'bad_subject');

    const longSubject = await verify(makeToken(validHeader, claims({ sub: 'x'.repeat(200) })), fakeNetwork());
    assert.equal((longSubject as { reason: string }).reason, 'bad_subject');

    const garbage = await verify('not.a.jwt.at.all', fakeNetwork());
    assert.equal((garbage as { reason: string }).reason, 'malformed');
  });

  it('checks revocation with POST and the API key, and never without one', async () => {
    __resetSigningKeyCacheForTests();
    const network = fakeNetwork();
    const token = makeToken(validHeader, claims());

    // No key configured: the signature path alone must still work, and no
    // Identity Toolkit request may be attempted (that missing `key=` is what
    // made the original implementation reject everyone).
    const withoutKey = await verify(token, network);
    assert.equal(withoutKey.ok, true);
    assert.equal(network.calls.filter((call) => call.url.includes('accounts:lookup')).length, 0);

    __resetSigningKeyCacheForTests();
    const withKey = fakeNetwork();
    const verified = await verifyFirebaseIdToken(token, {
      projectId: PROJECT_ID,
      fetch: withKey.fetchImpl,
      apiKey: 'test-api-key',
    });
    assert.equal(verified.ok, true);
    const lookup = withKey.calls.find((call) => call.url.includes('accounts:lookup'));
    assert.ok(lookup, 'the revocation check should run when a key exists');
    assert.equal(lookup.method, 'POST');
    assert.match(lookup.url, /key=test-api-key/);
    assert.ok(!lookup.url.includes('idToken='), 'the token belongs in the body, not the URL');
    assert.match(String(lookup.body), /idToken/);
  });

  it('treats a revoked token as fatal and an unreachable checker as not', async () => {
    __resetSigningKeyCacheForTests();
    const token = makeToken(validHeader, claims());

    const revoked = await verifyFirebaseIdToken(token, {
      projectId: PROJECT_ID,
      fetch: fakeNetwork({ lookup: { ok: true, body: { users: [] } } }).fetchImpl,
      apiKey: 'test-api-key',
    });
    assert.deepEqual(revoked, { ok: false, reason: 'revoked' });

    // A transport failure inside Google's API must not sign every user out,
    // because `exp` already bounds how long a leaked token stands.
    const unreachable = await verifyFirebaseIdToken(token, {
      projectId: PROJECT_ID,
      fetch: fakeNetwork({ certs: { [KID]: publicKey }, lookup: null }).fetchImpl,
      apiKey: 'test-api-key',
    });
    assert.equal(unreachable.ok, true);
  });

  it('serves cached keys when the certificate endpoint is down', async () => {
    __resetSigningKeyCacheForTests();
    const token = makeToken(validHeader, claims());
    const network = fakeNetwork();
    assert.equal((await verify(token, network)).ok, true);

    // Rotation outage: still verifiable with the last known good set.
    const outage = await verifyFirebaseIdToken(token, {
      projectId: PROJECT_ID,
      fetch: fakeNetwork({ throwOnCerts: true }).fetchImpl,
    });
    assert.equal(outage.ok, true);
  });

  it('requires a project id rather than guessing one', async () => {
    __resetSigningKeyCacheForTests();
    const network = fakeNetwork();
    const result = await verifyFirebaseIdToken(makeToken(validHeader, claims()), {
      projectId: '',
      fetch: network.fetchImpl,
    });
    assert.deepEqual(result, { ok: false, reason: 'malformed' });
    assert.equal(network.calls.length, 0, 'no network work should happen without a project id');
  });
});
