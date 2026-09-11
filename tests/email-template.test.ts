import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * src/lib/server/email — the shared branded template + sender resolution.
 *
 * These cover the two invariants every email depends on: every dynamic string
 * is HTML-escaped (an attacker-controlled household name must not be able to
 * inject markup into mail we send from our own domain), and the sender
 * falls back to the Resend sandbox only when nothing better is configured.
 */

import {
  DEFAULT_SENDER,
  fingerprint,
  isSandboxSender,
  renderBrandedEmail,
  resolveSender,
} from '../src/lib/server/email';

const baseInput = {
  language: 'en' as const,
  preheader: 'Preview text',
  title: 'Reset your password',
  greeting: 'Hello,',
  paragraphs: ['First paragraph.', 'Second one.'],
  cta: { label: 'Choose a new password', url: 'https://smartjib.app/auth/action?mode=resetPassword&oobCode=abc' },
  fallbackLinkCaption: 'If the button does not work, copy this link:',
  securityNote: 'Ignore this email if you did not ask for it.',
  automatedNotice: 'Automated message.',
  logoUrl: 'https://smartjib.app/logo-256.png',
  brandName: 'SmartJib',
  siteUrl: 'https://smartjib.app',
};

describe('renderBrandedEmail', () => {
  it('renders the title, paragraphs, CTA and preheader in the HTML body', () => {
    const { html } = renderBrandedEmail(baseInput);
    assert.match(html, /Reset your password/);
    assert.match(html, /First paragraph\./);
    assert.match(html, /Choose a new password/);
    assert.match(html, /Preview text/);
    assert.match(html, /https:\/\/smartjib\.app\/auth\/action\?mode=resetPassword&amp;oobCode=abc/);
  });

  it('escapes every dynamic string (household names, titles) in HTML', () => {
    const evil = '<script>alert(1)</script>';
    const { html, text } = renderBrandedEmail({
      ...baseInput,
      title: `You are invited to ${evil}`,
      highlight: { label: 'Household', value: evil },
    });
    assert.ok(!html.includes(evil), 'raw script tag must not appear in the html');
    assert.match(html, /&lt;script&gt;/);
    // The plain-text twin carries the raw copy — that is fine, it is quoted as text.
    assert.match(text, /alert/);
  });

  it('honours RTL direction for Arabic and LTR otherwise', () => {
    const { html: ar } = renderBrandedEmail({ ...baseInput, language: 'ar' });
    assert.match(ar, /dir="rtl"/);
    const { html: en } = renderBrandedEmail(baseInput);
    assert.match(en, /dir="ltr"/);
  });

  it('builds a plain-text twin with the raw link and no markup', () => {
    const { text } = renderBrandedEmail(baseInput);
    assert.match(text, /Reset your password/);
    assert.match(text, /Choose a new password: https:\/\/smartjib\.app\/auth\/action\?mode=resetPassword&oobCode=abc/);
    assert.match(text, /Ignore this email/);
    assert.ok(!text.includes('<'), 'text version must not contain html tags');
  });

  it('keeps emails without a CTA well-formed', () => {
    const { html, text } = renderBrandedEmail({ ...baseInput, cta: undefined, fallbackLinkCaption: undefined });
    assert.match(html, /First paragraph\./);
    assert.ok(!html.includes('Choose a new password'));
    assert.doesNotThrow(() => text.split('\n'));
  });
});

describe('sender resolution', () => {
  const KEYS = ['RESEND_FROM_EMAIL', 'RESEND_AUTH_FROM_EMAIL'] as const;
  let saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved = {};
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('falls back to the sandbox default when nothing is configured', () => {
    assert.equal(resolveSender(), DEFAULT_SENDER);
    assert.ok(isSandboxSender(resolveSender()));
  });

  it('uses RESEND_FROM_EMAIL for general mail and as the auth fallback', () => {
    process.env.RESEND_FROM_EMAIL = 'SmartJib <hello@smartjib.app>';
    assert.equal(resolveSender(), 'SmartJib <hello@smartjib.app>');
    assert.equal(resolveSender('auth'), 'SmartJib <hello@smartjib.app>');
    assert.ok(!isSandboxSender(resolveSender()));
  });

  it('prefers the dedicated RESEND_AUTH_FROM_EMAIL for auth mail only', () => {
    process.env.RESEND_FROM_EMAIL = 'SmartJib <hello@smartjib.app>';
    process.env.RESEND_AUTH_FROM_EMAIL = 'SmartJib Security <no-reply@smartjib.app>';
    assert.equal(resolveSender('auth'), 'SmartJib Security <no-reply@smartjib.app>');
    assert.equal(resolveSender(), 'SmartJib <hello@smartjib.app>');
  });
});

describe('fingerprint', () => {
  it('is stable and compact, for idempotency keys', () => {
    assert.equal(fingerprint('https://example/?x=1'), fingerprint('https://example/?x=1'));
    assert.notEqual(fingerprint('a'), fingerprint('b'));
    assert.match(fingerprint('anything'), /^[0-9a-f]{32}$/);
  });
});
