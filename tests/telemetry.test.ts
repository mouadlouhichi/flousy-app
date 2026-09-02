/**
 * Telemetry sinks: DSN parsing, envelope shape, and the "inert without env,
 * never throws with env" contract of forwardClientErrorReport.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  forwardClientErrorReport,
  sentryEndpointFromDsn,
  sentryEnvelopeFromReport,
  type ClientErrorReport,
} from '../src/lib/server/telemetry';

const realFetch = globalThis.fetch;
const ENV_KEYS = ['SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_DSN', 'BETTERSTACK_API_KEY', 'BETTERSTACK_URL'];

beforeEach(() => ENV_KEYS.forEach((k) => delete process.env[k]));
afterEach(() => {
  globalThis.fetch = realFetch;
  ENV_KEYS.forEach((k) => delete process.env[k]);
});

const REPORT: ClientErrorReport = {
  kind: 'unhandledrejection',
  message: 'boom',
  stack: 'Error: boom\n  at x.js:1:1',
  path: '/dashboard',
  userAgent: 'test-agent',
  at: '2026-09-02T10:00:00.000Z',
};

test('sentryEndpointFromDsn derives the envelope endpoint', () => {
  assert.equal(
    sentryEndpointFromDsn('https://abc123@o4507.ingest.us.sentry.io/4509'),
    'https://o4507.ingest.us.sentry.io/api/4509/envelope/?sentry_key=abc123&sentry_version=7',
  );
});

test('sentryEndpointFromDsn rejects garbage instead of throwing', () => {
  assert.equal(sentryEndpointFromDsn('not a dsn'), null);
  assert.equal(sentryEndpointFromDsn('http://insecure@host/1'), null);
  assert.equal(sentryEndpointFromDsn('https://key@host/not-a-number'), null);
});

test('sentryEnvelopeFromReport emits a parseable three-line envelope', () => {
  const envelope = sentryEnvelopeFromReport(REPORT, 'a'.repeat(32));
  const [header, itemHeader, event] = envelope.split('\n').map((line) => JSON.parse(line));
  assert.equal(header.event_id, 'a'.repeat(32));
  assert.equal(itemHeader.type, 'event');
  assert.equal(event.level, 'error');
  assert.equal(event.message.formatted, 'boom');
  assert.equal(event.tags.kind, 'unhandledrejection');
  assert.equal(event.extra.stack, REPORT.stack);
});

test('without env vars no network call is made', async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  await forwardClientErrorReport(REPORT);
  assert.equal(calls, 0);
});

test('with both sinks configured, both endpoints receive the report', async () => {
  process.env.SENTRY_DSN = 'https://abc123@o1.ingest.sentry.io/42';
  process.env.BETTERSTACK_API_KEY = 'bs-token';
  const seen: Array<{ url: string; auth?: string }> = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    seen.push({ url: String(url), auth: (init?.headers as Record<string, string>)?.Authorization });
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  await forwardClientErrorReport(REPORT);

  const urls = seen.map((c) => c.url).sort();
  assert.equal(urls.length, 2);
  assert.match(urls[0], /^https:\/\/in\.logs\.betterstack\.com$/);
  assert.match(urls[1], /^https:\/\/o1\.ingest\.sentry\.io\/api\/42\/envelope\//);
  assert.equal(seen.find((c) => c.url.includes('betterstack'))?.auth, 'Bearer bs-token');
});

test('sink failures never reject', async () => {
  process.env.SENTRY_DSN = 'https://abc123@o1.ingest.sentry.io/42';
  process.env.BETTERSTACK_API_KEY = 'bs-token';
  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;
  await assert.doesNotReject(() => forwardClientErrorReport(REPORT));
});

test('BETTERSTACK_URL overrides the default ingest host', async () => {
  process.env.BETTERSTACK_API_KEY = 'bs-token';
  process.env.BETTERSTACK_URL = 'https://s123.eu-nbg-2.betterstackdata.com/';
  const urls: string[] = [];
  globalThis.fetch = (async (url: unknown) => {
    urls.push(String(url));
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  await forwardClientErrorReport(REPORT);
  assert.deepEqual(urls, ['https://s123.eu-nbg-2.betterstackdata.com']);
});
