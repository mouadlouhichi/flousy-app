import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, POST } from '../src/app/api/contact/route';

const savedEnvironment = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL,
  VERCEL_ENV: process.env.VERCEL_ENV,
};
const savedFetch = globalThis.fetch;

before(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.CONTACT_TO_EMAIL;
  delete process.env.VERCEL_ENV;
});

after(() => {
  globalThis.fetch = savedFetch;
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function request(body: unknown, options: { origin?: string; ip?: string } = {}) {
  return new NextRequest('https://flousy.app/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'flousy.app',
      origin: options.origin ?? 'https://flousy.app',
      'x-forwarded-for': options.ip ?? crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
}

const validMessage = () => ({
  name: 'Amina',
  email: 'amina@example.com',
  topic: 'Feedback',
  message: 'This is a real contact message.',
  locale: 'en',
  requestId: crypto.randomUUID(),
  website: '',
});

describe('contact delivery endpoint', () => {
  it('reports deployment readiness without sending or exposing secrets', async () => {
    const response = await GET();
    assert.deepEqual(await response.json(), {
      ready: false,
      code: 'contact_not_configured',
      sandboxSender: false,
      environment: process.env.NODE_ENV || 'unknown',
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });

  it('rejects cross-origin browser submissions', async () => {
    const response = await POST(request(validMessage(), { origin: 'https://evil.example' }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'origin_not_allowed');
  });

  it('validates fields before attempting delivery', async () => {
    const response = await POST(request({ ...validMessage(), message: 'short' }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'invalid_contact');
  });

  it('does not claim delivery when server email is unconfigured', async () => {
    const response = await POST(request(validMessage()));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'contact_not_configured');
  });

  it('silently drops honeypot submissions without consuming email quota', async () => {
    const response = await POST(request({ ...validMessage(), website: 'https://spam.example' }));
    assert.equal(response.status, 202);
    assert.equal((await response.json()).code, 'accepted');
  });

  it('deduplicates retries and passes the stable request ID to Resend', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'SmartJib <hello@flousy.app>';
    process.env.CONTACT_TO_EMAIL = 'support@flousy.app';
    const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ id: 'email-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    try {
      const message = validMessage();
      const first = await POST(request(message));
      const retry = await POST(request(message));

      assert.equal(first.status, 202);
      assert.equal((await first.json()).code, 'accepted_for_delivery');
      assert.equal(retry.status, 200);
      assert.equal((await retry.json()).code, 'already_accepted');
      assert.equal(calls.length, 1);
      assert.equal(
        new Headers(calls[0].init?.headers).get('idempotency-key'),
        `contact-${message.requestId}`,
      );
    } finally {
      globalThis.fetch = savedFetch;
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_FROM_EMAIL;
      delete process.env.CONTACT_TO_EMAIL;
    }
  });

  it('reserves an idempotency key while delivery is in progress', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'SmartJib <hello@flousy.app>';
    process.env.CONTACT_TO_EMAIL = 'support@flousy.app';
    let releaseDelivery!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const released = new Promise<void>((resolve) => { releaseDelivery = resolve; });
    globalThis.fetch = async () => {
      markStarted();
      await released;
      return new Response(JSON.stringify({ id: 'email-concurrent' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    try {
      const message = validMessage();
      const firstPromise = POST(request(message));
      await started;
      const concurrent = await POST(request(message));
      assert.equal(concurrent.status, 409);
      assert.equal((await concurrent.json()).code, 'delivery_in_progress');

      releaseDelivery();
      const first = await firstPromise;
      assert.equal(first.status, 202);
      assert.equal((await first.json()).code, 'accepted_for_delivery');
    } finally {
      releaseDelivery();
      globalThis.fetch = savedFetch;
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_FROM_EMAIL;
      delete process.env.CONTACT_TO_EMAIL;
    }
  });

  it('releases a failed reservation so the same request can be retried', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'SmartJib <hello@flousy.app>';
    process.env.CONTACT_TO_EMAIL = 'support@flousy.app';
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return calls === 1
        ? new Response(JSON.stringify({ name: 'delivery_failed', message: 'temporary failure' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          })
        : new Response(JSON.stringify({ id: 'email-retry' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
    };

    try {
      const message = validMessage();
      const failed = await POST(request(message));
      const retried = await POST(request(message));
      assert.equal(failed.status, 502);
      assert.equal((await failed.json()).code, 'delivery_failed');
      assert.equal(retried.status, 202);
      assert.equal((await retried.json()).code, 'accepted_for_delivery');
      assert.equal(calls, 2);
    } finally {
      globalThis.fetch = savedFetch;
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_FROM_EMAIL;
      delete process.env.CONTACT_TO_EMAIL;
    }
  });

  it('refuses the Resend sandbox identity on the production deployment', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'SmartJib <onboarding@resend.dev>';
    process.env.CONTACT_TO_EMAIL = 'hello@example.com';
    process.env.VERCEL_ENV = 'production';
    try {
      const response = await POST(request(validMessage()));
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, 'contact_not_configured');
    } finally {
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_FROM_EMAIL;
      delete process.env.CONTACT_TO_EMAIL;
      delete process.env.VERCEL_ENV;
    }
  });
});
