import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import en from '../../../../messages/en.json';
import fr from '../../../../messages/fr.json';
import ar from '../../../../messages/ar.json';
import { formatMessage, type Language, type Messages } from '@/lib/i18n-core';

export const runtime = 'nodejs';

const EMAIL_MESSAGES: Record<Language, Messages> = { en, fr, ar };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Sends a locale-aware, escaped household invitation email. */
export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Invitation email is not configured.' }, { status: 503 });

  try {
    const { email, householdName, role, inviteId, locale } = await request.json() as Record<string, string | undefined>;
    if (!email || !householdName || !role || !inviteId || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid invitation request.' }, { status: 400 });
    }
    if (!['editor', 'viewer', 'custom'].includes(role)) {
      return NextResponse.json({ error: 'Invalid household role.' }, { status: 400 });
    }

    const language: Language = locale === 'ar' || locale === 'fr' ? locale : 'en';
    const messages = EMAIL_MESSAGES[language];
    const localizedRole = messages.householdRoles[role as keyof typeof messages.householdRoles];
    const emailCopy = messages.household;
    const interpolate = (template: string) =>
      formatMessage(template, { household: householdName, role: localizedRole });
    const baseUrl = process.env.APP_URL || request.nextUrl.origin;
    const acceptUrl = `${baseUrl}/dashboard/profile?invite=${encodeURIComponent(inviteId)}`;

    const delivery = await new Resend(apiKey).emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'SmartJib <onboarding@resend.dev>',
      to: email,
      subject: interpolate(emailCopy.emailSubject),
      html: `<div dir="${language === 'ar' ? 'rtl' : 'ltr'}"><p>${escapeHtml(emailCopy.emailGreeting)}</p><p>${escapeHtml(interpolate(emailCopy.emailBody))}</p><p><a href="${escapeHtml(acceptUrl)}">${escapeHtml(emailCopy.emailAccept)}</a></p><p>${escapeHtml(emailCopy.emailExpires)}</p></div>`,
      text: [
        emailCopy.emailGreeting,
        interpolate(emailCopy.emailBody),
        `${emailCopy.emailAccept}: ${acceptUrl}`,
        emailCopy.emailExpires,
      ].join('\n\n'),
    });
    if (delivery.error) return NextResponse.json({ error: 'Invitation delivery failed.' }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Household invitation email failed', error);
    return NextResponse.json({ error: 'Unable to send invitation email.' }, { status: 500 });
  }
}
