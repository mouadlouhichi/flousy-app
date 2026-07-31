import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const runtime = 'nodejs';

/**
 * Temporary Resend-only invitation sender.
 * Firestore rules still protect who can create invitation records in the app.
 * Restore Firebase Admin token/ownership verification before public launch.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Invitation email is not configured: missing RESEND_API_KEY in Vercel.' }, { status: 503 });

  try {
    const { email, householdName, role, inviteId } = await request.json() as Record<string, string | undefined>;
    if (!email || !householdName || !role || !inviteId || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'A valid recipient, household, role, and invitation are required.' }, { status: 400 });
    }
    if (!['contributor', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid household role.' }, { status: 400 });
    }
    const baseUrl = process.env.APP_URL || request.nextUrl.origin;
    const acceptUrl = `${baseUrl}/dashboard/profile?invite=${encodeURIComponent(inviteId)}`;
    const delivery = await new Resend(apiKey).emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'SmartJib <onboarding@resend.dev>',
      to: email,
      subject: `You are invited to ${householdName}`,
      html: `<p>Hello,</p><p>You were invited to join <strong>${householdName}</strong> as a <strong>${role}</strong>.</p><p><a href="${acceptUrl}">Accept invitation</a></p><p>This invitation expires in 14 days.</p>`,
    });
    if (delivery.error) return NextResponse.json({ error: `Resend rejected the invitation: ${delivery.error.message}` }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Household invitation email failed', error);
    return NextResponse.json({ error: 'Unable to send invitation email.' }, { status: 500 });
  }
}
