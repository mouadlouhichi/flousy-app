import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * /api/contact — the network-free paths.
 *
 * Everything up to (but excluding) the actual Resend call is exercised:
 * readiness reporting, JSON/field validation, the honeypot, missing-config
 * degradation and the production sandbox-sender refusal. The send itself and
 * per-IP limiting are covered by the route's structure plus manual/E2E checks,
 * since faking Resend's network layer here would test the mock, not the route.
 */

type RouteModule = typeof import('../src/app/api/contact/route');

let route: RouteModule;

async function loadRoute(): Promise<RouteModule> {
  if (!route) route = await import('../src/app/api/contact/route');
  return route;
}

const ENV_KEYS = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'CONTACT_TO_EMAIL', 'VERCEL_ENV'] as const;
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

function post(body: unknown): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validPayload = {
  name: 'Amina',
  email: 'amina@example.com',
  topic: 'Question about Pro',
  message: 'Hello — does the 90-day trial need a card?',
  requestId: 'req-test-0001',
};

describe('/api/contact readiness (GET)', () => {
  it('reports email_not_configured when credentials are missing', async () => {
    const { GET } = await loadRoute();
    const res = await GET();
    const data = await res.json();
    assert.equal(data.ready, false);
    assert.equal(data.code, 'email_not_configured');
  });

  it('requires CONTACT_TO_EMAIL, not just the Resend key', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    const { GET } = await loadRoute();
    const data = await (await GET()).json();
    assert.equal(data.code, 'email_not_configured');
  });

  it('flags the sandbox sender in production', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.CONTACT_TO_EMAIL = 'inbox@example.com';
    process.env.VERCEL_ENV = 'production';
    // RESEND_FROM_EMAIL unset => default onboarding@resend.dev sender.
    const { GET } = await loadRoute();
    const data = await (await GET()).json();
    assert.equal(data.ready, false);
    assert.equal(data.code, 'sandbox_sender');
  });
});

describe('/api/contact submission (POST)', () => {
  it('rejects a non-JSON body', async () => {
    const { POST } = await loadRoute();
    const res = await POST(post('this is not json{{') as never);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'invalid_body');
  });

  it('rejects each missing or oversized field by name', async () => {
    const { POST } = await loadRoute();
    const bad: Array<[Record<string, unknown>, string]> = [
      [{ ...validPayload, name: '' }, 'name'],
      [{ ...validPayload, name: 'x'.repeat(121) }, 'name'],
      [{ ...validPayload, email: 'not-an-email' }, 'email'],
      [{ ...validPayload, topic: 'x'.repeat(151) }, 'topic'],
      [{ ...validPayload, message: '' }, 'message'],
      [{ ...validPayload, message: 'x'.repeat(5001) }, 'message'],
      [{ ...validPayload, requestId: '' }, 'requestId'],
    ];
    for (const [payload, field] of bad) {
      const res = await POST(post(payload) as never);
      assert.equal(res.status, 400, field);
      const data = await res.json();
      assert.equal(data.code, 'invalid_field', field);
      assert.equal(data.field, field);
    }
  });

  it('answers the honeypot with a fake success and never validates further', async () => {
    const { POST } = await loadRoute();
    // Even a payload that would fail validation "succeeds" when the trap is
    // filled — a bot must not be able to tell it was caught.
    const res = await POST(post({ website: 'https://spam.example', name: '' }) as never);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.sent, true);
  });

  it('degrades truthfully when mail is not configured', async () => {
    const { POST } = await loadRoute();
    const res = await POST(post(validPayload) as never);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'email_not_configured');
  });

  it('refuses the sandbox sender in production instead of dropping mail', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.CONTACT_TO_EMAIL = 'inbox@example.com';
    process.env.VERCEL_ENV = 'production';
    const { POST } = await loadRoute();
    const res = await POST(post(validPayload) as never);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'sandbox_sender');
  });
});
