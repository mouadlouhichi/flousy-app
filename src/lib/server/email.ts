/**
 * Transactional email — shared Resend delivery and the branded template.
 *
 * Every email the product sends from its own domain (household invitations,
 * auth links, reminder digests) goes through `renderBrandedEmail` so they all
 * share one design: mint canvas, forest-green brand header, white rounded
 * card, lime-accented button, muted footer. The markup is deliberately
 * table-based with fully inline styles — the only HTML-email-safe approach —
 * and supports RTL (`dir="rtl"`) for Arabic.
 *
 * Configuration (server-side only):
 * - RESEND_API_KEY           — Resend API key. Unset ⇒ `isEmailConfigured()`
 *                              is false and callers report `email_not_configured`.
 * - RESEND_FROM_EMAIL        — default sender, e.g. `SmartJib <hello@smartjib.app>`.
 * - RESEND_AUTH_FROM_EMAIL   — optional dedicated sender for auth/security
 *                              mail (falls back to RESEND_FROM_EMAIL).
 *
 * The `onboarding@resend.dev` sandbox sender only ever delivers to the
 * address verified on the Resend account, so production deployments must
 * switch to a sender on their SPF/DKIM-verified domain.
 */
import { createHash } from 'node:crypto';
import { Resend } from 'resend';
import type { Language } from '@/lib/i18n-core';

export const SANDBOX_SENDER = '@resend.dev';
export const DEFAULT_SENDER = `SmartJib <onboarding${SANDBOX_SENDER}>`;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Short, URL/email-safe fingerprint for idempotency keys — never reversible. */
export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type EmailAudience = 'general' | 'auth';

/**
 * Sender for a kind of email. Auth/security mail can ride its own identity
 * (`no-reply@…`) via RESEND_AUTH_FROM_EMAIL; everything else (invitations,
 * contact, digests) uses RESEND_FROM_EMAIL. A sandbox sender is refused in
 * production by the routes that send, not here — previews keep working.
 */
export function resolveSender(audience: EmailAudience = 'general'): string {
  if (audience === 'auth') {
    const dedicated = process.env.RESEND_AUTH_FROM_EMAIL?.trim();
    if (dedicated) return dedicated;
  }
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_SENDER;
}

export function isSandboxSender(from: string): boolean {
  return from.includes(SANDBOX_SENDER);
}

/* -------------------------------------------------------------------------- */
/* Deployment environment                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `NODE_ENV` is `production` on Vercel **preview** deployments too, so it
 * cannot distinguish "reviewer's build" from "the real site". `VERCEL_ENV`
 * can; fall back to NODE_ENV only when the platform did not say.
 */
export function isProductionDeployment(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv === 'production';
  return process.env.NODE_ENV === 'production';
}

function vercelUrl(name: string): string | undefined {
  const value = process.env[name];
  return value ? `https://${value.replace(/^https?:\/\//, '')}` : undefined;
}

/**
 * Base URL for links inside emails.
 *
 * An email link grants access (accept an invitation, reset a password), so it
 * must never be derived from the incoming request's `Host` header — that is
 * attacker-controlled text on mail we send from our own domain. Only
 * platform-provided values are used: previews point at the preview deployment
 * (so the flow stays testable) and production at the configured site origin.
 */
export function resolveAppBaseUrl(): string {
  const production = isProductionDeployment();
  const candidates = production
    ? [process.env.APP_URL, process.env.NEXT_PUBLIC_SITE_URL, vercelUrl('VERCEL_PROJECT_PRODUCTION_URL')]
    : [vercelUrl('VERCEL_URL'), vercelUrl('VERCEL_PROJECT_PRODUCTION_URL'), process.env.APP_URL, process.env.NEXT_PUBLIC_SITE_URL];
  for (const candidate of candidates) {
    const value = (candidate || '').trim().replace(/\/+$/, '');
    if (!value) continue;
    try {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      if (url.hostname.includes('.') || url.hostname === 'localhost') return url.origin;
    } catch {
      /* try the next candidate */
    }
  }
  return 'https://smartjib.app';
}

/* -------------------------------------------------------------------------- */
/* Template                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Brand palette mirrored from src/index.css. Email clients ignore stylesheets
 * and CSS variables, so the values are inlined here — keep the two files in
 * sync when the brand colours change.
 */
const BRAND = {
  canvas: '#f3f7f3', // --background
  card: '#ffffff', // --surface-container-lowest
  forest: '#0f3b36', // --forest / --primary
  forestDeep: '#0a2c28', // --forest-deep
  lime: '#c5e6a6', // --lime accent
  text: '#0e1a17', // --on-surface
  muted: '#5b6b63', // --on-surface-variant
  outline: '#dbe5dc', // --outline-variant
  soft: '#edf3ee', // --surface-container-high
} as const;

export interface BrandedEmailInput {
  language: Language;
  /** Hidden inbox-preview snippet shown after the subject. */
  preheader: string;
  /** Main heading inside the card. */
  title: string;
  /** Salutation line, e.g. "Hello,". */
  greeting?: string;
  /** Paragraphs of body copy (already localized and interpolated). */
  paragraphs: string[];
  /** Optional highlighted value (household name, account email…) on a lime pill. */
  highlight?: { label: string; value: string };
  /** Primary call to action. Omitted for purely informational mail. */
  cta?: { label: string; url: string };
  /** Caption above the raw fallback URL under the button. */
  fallbackLinkCaption?: string;
  /** Reassurance line under a divider ("you can ignore this…"). */
  securityNote?: string;
  /** Centered muted line under the card (automated-message notice). */
  automatedNotice?: string;
  /** Absolute URL of the logo image. */
  logoUrl: string;
  /** Brand wordmark (e.g. "smartjib"); a trailing dot is rendered in lime. */
  brandName: string;
  siteUrl: string;
}

/** Bulletproof(ish) primary button: anchor + VML fallback for Outlook desktop. */
function renderButton(cta: { label: string; url: string }): string {
  const href = escapeHtml(cta.url);
  const label = escapeHtml(cta.label);
  const anchor =
    `<a href="${href}" target="_blank" rel="noopener" style="display:inline-block;background-color:${BRAND.forest};` +
    `color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:50px;padding:0 36px;` +
    `border-radius:999px;mso-hide:all;">${label}</a>`;
  return `<!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:50px;v-text-anchor:middle;width:320px;" arcsize="50%" fillcolor="${BRAND.forest}" stroke="f">
                <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">${label}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->${anchor}<!--<![endif]-->`;
}

/**
 * One white-card row. Rows are stacked inside the same 600px table and the
 * top/bottom rows carry the card's rounded corners, so any combination of
 * middle rows stays well-formed.
 */
function cardRow(content: string, options: { center?: boolean; padding?: string; border?: 'bottom' } = {}): string {
  const { center = false, padding = '0 40px', border } = options;
  const edges = border === 'bottom' ? `border:1px solid ${BRAND.outline};border-top:0;` : `border-left:1px solid ${BRAND.outline};border-right:1px solid ${BRAND.outline};`;
  const rounded = border === 'bottom' ? 'border-radius:0 0 20px 20px;' : '';
  return `          <tr>
            <td ${center ? 'align="center"' : ''} style="background-color:${BRAND.card};${edges}${rounded}padding:${padding};">
${content}
            </td>
          </tr>`;
}

/**
 * Render one branded transactional email as HTML + plain-text.
 *
 * ALL dynamic strings are HTML-escaped here: call sites pass raw localized
 * copy and trust this function to make it safe for the `<body>`.
 */
export function renderBrandedEmail(input: BrandedEmailInput): { html: string; text: string } {
  const rtl = input.language === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  const year = new Date().getUTCFullYear();
  const brand = escapeHtml(input.brandName);
  const title = escapeHtml(input.title);
  const logo = escapeHtml(input.logoUrl);
  const site = escapeHtml(input.siteUrl);
  const font = "'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,'Helvetica Neue',Arial,sans-serif";

  /* ---- card rows ---------------------------------------------------------- */

  const bodyRow = cardRow(
    `              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}">
                <tr><td>
                  <h1 style="margin:0 0 18px;font-family:${font};font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;color:${BRAND.text};text-align:${align};mso-line-height-rule:exactly;">${title}</h1>${
      input.greeting ? `\n                  <p style="margin:0 0 16px;font-family:${font};font-size:15px;line-height:1.65;color:${BRAND.text};text-align:${align};">${escapeHtml(input.greeting)}</p>` : ''
    }
${input.paragraphs
  .map(
    (p) =>
      `                  <p style="margin:0 0 16px;font-family:${font};font-size:15px;line-height:1.65;color:${BRAND.text};text-align:${align};">${escapeHtml(p)}</p>`,
  )
  .join('\n')}
                </td></tr>
              </table>`,
    { padding: '36px 40px 20px' },
  );

  const highlightRow = input.highlight
    ? cardRow(
        `              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="background-color:${BRAND.soft};border:1px solid ${BRAND.outline};border-radius:12px;padding:10px 18px;font-family:${font};font-size:14px;color:${BRAND.muted};">
                    ${escapeHtml(input.highlight.label)}
                    <span style="display:inline-block;background-color:${BRAND.lime};color:${BRAND.forestDeep};font-weight:700;border-radius:999px;padding:4px 14px;margin:0 6px;font-size:14px;">${escapeHtml(input.highlight.value)}</span>
                  </td>
                </tr>
              </table>`,
        { center: true, padding: '0 40px 24px' },
      )
    : '';

  let ctaRow = '';
  if (input.cta) {
    const fallback = input.fallbackLinkCaption
      ? `
              <p style="margin:18px 0 6px;font-family:${font};font-size:12px;line-height:1.5;color:${BRAND.muted};text-align:center;">${escapeHtml(input.fallbackLinkCaption)}</p>
              <p style="margin:0;font-family:${font};font-size:12px;line-height:1.5;word-break:break-all;text-align:center;"><a href="${escapeHtml(input.cta.url)}" target="_blank" rel="noopener" style="color:${BRAND.forest};text-decoration:underline;">${escapeHtml(input.cta.url)}</a></p>`
      : '';
    ctaRow = cardRow(
      `              <div style="text-align:center;">
${renderButton(input.cta)}
              </div>${fallback}`,
      { padding: '4px 40px 24px' },
    );
  }

  const securityRow = input.securityNote
    ? cardRow(
        `              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid ${BRAND.outline};padding-top:18px;">
                  <p style="margin:0;font-family:${font};font-size:12.5px;line-height:1.6;color:${BRAND.muted};text-align:center;">${escapeHtml(input.securityNote)}</p>
                </td></tr>
              </table>`,
        { padding: '0 40px 30px' },
      )
    : cardRow('&nbsp;', { padding: '0 40px 6px' }); // keeps the bottom strip attached when there is no note

  // Lime strip closing the card — the signature brand flourish.
  const bottomRow = cardRow(
    `              <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0">
                <tr><td width="120" height="4" style="background-color:${BRAND.lime};border-radius:0 0 999px 999px;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>`,
    { center: true, padding: '0 40px 6px', border: 'bottom' },
  );

  /* ---- assembly ----------------------------------------------------------- */

  const html = `<!doctype html>
<html lang="${input.language}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
    <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;word-spacing:normal;background-color:${BRAND.canvas};" dir="${dir}">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.canvas};">
      <tr>
        <td align="center" style="padding:28px 16px 40px;">
          <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
            <!-- Brand header -->
            <tr>
              <td dir="${dir}" style="background-color:${BRAND.forest};background-image:linear-gradient(135deg,${BRAND.forest} 0%,${BRAND.forestDeep} 100%);border-radius:20px 20px 0 0;padding:26px 40px;" align="${align}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="44" style="vertical-align:middle;">
                      <img src="${logo}" width="44" height="44" alt="${brand}" style="display:block;border:0;border-radius:12px;width:44px;height:44px;background-color:#ffffff;" />
                    </td>
                    <td style="padding:0 12px;vertical-align:middle;">
                      <span style="font-family:${font};font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">${brand}<span style="color:${BRAND.lime};">.</span></span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
${bodyRow}
${highlightRow}
${ctaRow}
${securityRow}
${bottomRow}
            <!-- Footer -->
            <tr>
              <td align="center" style="padding:22px 24px 0;">
${
  input.automatedNotice
    ? `                <p style="margin:0 0 6px;font-family:${font};font-size:12px;line-height:1.6;color:${BRAND.muted};text-align:center;">${escapeHtml(input.automatedNotice)}</p>\n`
    : ''
}                <p style="margin:0;font-family:${font};font-size:12px;line-height:1.6;color:${BRAND.muted};text-align:center;"><a href="${site}" target="_blank" rel="noopener" style="color:${BRAND.muted};text-decoration:underline;">${site}</a> &nbsp;·&nbsp; © ${year} ${brand}</p>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;

  // Plain-text twin: same message, no markup, CTA as a raw URL.
  const textLines: string[] = [input.title, ''];
  if (input.greeting) textLines.push(input.greeting, '');
  textLines.push(...input.paragraphs, '');
  if (input.highlight) textLines.push(`${input.highlight.label}: ${input.highlight.value}`, '');
  if (input.cta) {
    textLines.push(`${input.cta.label}: ${input.cta.url}`, '');
  }
  if (input.securityNote) textLines.push(input.securityNote, '');
  if (input.automatedNotice) textLines.push(input.automatedNotice, '');
  textLines.push(`© ${year} ${input.brandName} — ${input.siteUrl}`);
  return { html, text: textLines.join('\n') };
}

/* -------------------------------------------------------------------------- */
/* Delivery                                                                    */
/* -------------------------------------------------------------------------- */

export interface SendEmailResult {
  ok: boolean;
  /** Provider error message (already sanitized by Resend's SDK). */
  error?: string;
}

export async function sendEmail(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Stable across retries of the SAME logical send (e.g. derived from the action link). */
  idempotencyKey?: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'email_not_configured' };
  try {
    const client = new Resend(apiKey);
    const delivery = await client.emails.send(
      {
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      },
      options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined,
    );
    if (delivery.error) {
      console.error('Resend refused the email', delivery.error);
      return { ok: false, error: delivery.error.message };
    }
    return { ok: true };
  } catch (error) {
    console.error('Resend send threw', error);
    return { ok: false, error: 'send_threw' };
  }
}
