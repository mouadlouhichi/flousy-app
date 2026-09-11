import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * /api/auth/email — the network-free paths.
 *
 * Exercised: readiness reporting (GET), request-shape validation, the
 * missing-config 503 codes the client uses to fall back to Firebase's
 * default mailer, the production sandbox-sender refusal, per-address rate
 * limiting and the missing-token 401. What is NOT exercised: real link
 * generation (needs Google) and real delivery (needs Resend) — faking those
 * network layers here would test the mock, not the route.
 */

type RouteModule = typeof import('../src/app/api/auth/email/route');

let route: RouteModule;

async function loadRoute(): Promise<RouteModule> {
  if (!route) route = await import('../src/app/api/auth/email/route');
  return route;
}

const ENV_KEYS = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_AUTH_FROM_EMAIL',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'VERCEL_ENV',
  'ARCJET_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
] as const;
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/auth/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Junk-but-parseable service account: cert() fails inside, so no network is needed. */
function configureMail() {
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{"project_id":"demo-test"}';
  process.env.RESEND_FROM_EMAIL = 'SmartJib <hello@smartjib.app>';
}

describe('/api/auth/email readiness (GET)', () => {
  it('reports email_not_configured when nothing is set', async () => {
    const { GET } = await loadRoute();
    const res = await GET();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.emailConfigured, false);
    assert.equal(body.code, 'email_not_configured');
  });

  it('reports admin_not_configured when only Resend is set', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    const { GET } = await loadRoute();
    const body = await (await GET()).json();
    assert.equal(body.emailConfigured, true);
    assert.equal(body.adminConfigured, false);
    assert.equal(body.code, 'admin_not_configured');
  });

  it('flags the sandbox sender in production once fully configured', async () => {
    configureMail();
    process.env.VERCEL_ENV = 'production';
    process.env.RESEND_AUTH_FROM_EMAIL = 'SmartJib <onboarding@resend.dev>';
    const { GET } = await loadRoute();
    const body = await (await GET()).json();
    assert.equal(body.code, 'sandbox_sender');
  });

  it('reports ready for a fully configured production deployment', async () => {
    configureMail();
    process.env.VERCEL_ENV = 'production';
    const { GET } = await loadRoute();
    const body = await (await GET()).json();
    assert.equal(body.code, 'ready');
  });
});

describe('/api/auth/email request validation (POST)', () => {
  it('rejects unknown kinds with 400', async () => {
    const { POST } = await loadRoute();
    const res = await POST(post({ kind: 'newsletter' }) as never);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'invalid_kind');
  });

  it('answers 503 email_not_configured when the mail service is not wired', async () => {
    const { POST } = await loadRoute();
    const res = await POST(post({ kind: 'password_reset', email: 'user@example.com' }) as never);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.code, 'email_not_configured');
    assert.ok(body.hint, 'config errors carry an actionable hint');
  });

  it('rejects malformed reset addresses with 400 once configured', async () => {
    configureMail();
    const { POST } = await loadRoute();
    const res = await POST(post({ kind: 'password_reset', email: 'not-an-email' }) as never);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'invalid_email');
  });

  it('refuses the Resend sandbox sender in production before touching mail', async () => {
    configureMail();
    process.env.VERCEL_ENV = 'production';
    process.env.RESEND_AUTH_FROM_EMAIL = 'SmartJib <onboarding@resend.dev>';
    const { POST } = await loadRoute();
    const res = await POST(post({ kind: 'password_reset', email: 'user@example.com' }) as never);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.code, 'sandbox_sender');
  });

  it('requires a bearer token for verification emails', async () => {
    configureMail();
    const { POST } = await loadRoute();
    const res = await POST(post({ kind: 'email_verification' }) as never);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'unauthorized');
  });

  it('rate-limits repeated reset requests for the same address', async () => {
    configureMail();
    const { POST } = await loadRoute();
    const email = `ratelimit${Date.now()}@example.com`;
    const send = () => POST(post({ kind: 'password_reset', email }) as never);
    const codes: number[] = [];
    for (let i = 0; i < 4; i += 1) codes.push((await send()).status);
    // The junk service account means link generation itself cannot succeed,
    // but every attempt must count against the budget…
    for (const status of codes) assert.equal(status, 503);
    // …so the next one is refused before any provider is contacted.
    const res = await send();
    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.code, 'rate_limited');
  });
});
