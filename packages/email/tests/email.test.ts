import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  escapeHtml,
  getEmailConfig,
  probeEmailConfig,
  renderHouseholdInvite,
  resolveAppBaseUrl,
} from '../src/index';

test('escapeHtml encodes markup', () => {
  assert.equal(escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
});

test('probe reports missing API key', () => {
  const config = getEmailConfig({ NODE_ENV: 'development' });
  assert.equal(probeEmailConfig(config).code, 'email_not_configured');
});

test('sandbox sender is refused in production', () => {
  const config = getEmailConfig({
    NODE_ENV: 'production',
    VERCEL_ENV: 'production',
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'SmartJib <onboarding@resend.dev>',
  });
  assert.equal(probeEmailConfig(config).code, 'sandbox_sender');
});

test('preview may use the sandbox sender', () => {
  const config = getEmailConfig({
    NODE_ENV: 'production',
    VERCEL_ENV: 'preview',
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'SmartJib <onboarding@resend.dev>',
  });
  assert.equal(probeEmailConfig(config).code, 'ready');
});

test('resolveAppBaseUrl ignores Host-like junk and uses APP_URL', () => {
  assert.equal(
    resolveAppBaseUrl({ VERCEL_ENV: 'production', APP_URL: 'https://flousy.app/' }),
    'https://flousy.app',
  );
});

test('invite template interpolates and escapes', () => {
  const rendered = renderHouseholdInvite({
    recipient: 'a@b.co',
    language: 'en',
    householdName: 'Home <script>',
    roleLabel: 'Viewer',
    acceptUrl: 'https://flousy.app/dashboard/profile?invite=abc',
    copy: {
      emailSubject: 'Join {household}',
      emailGreeting: 'Hi',
      emailBody: 'You were invited to {household} as {role}',
      emailAccept: 'Accept',
      emailExpires: 'Expires soon',
    },
    interpolate: (template) => template.replace('{household}', 'Home <script>').replace('{role}', 'Viewer'),
  });
  assert.match(rendered.subject, /Home <script>/);
  assert.match(rendered.html, /Home &lt;script&gt;/);
  assert.match(rendered.text, /https:\/\/flousy.app\/dashboard\/profile\?invite=abc/);
});
