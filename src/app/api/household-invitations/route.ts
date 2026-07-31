import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Fail safely with actionable configuration messages; never expose a secret.
  const missingAdmin = ['FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PRIVATE_KEY'].filter((key) => !process.env[key]);
  if (missingAdmin.length) return NextResponse.json({ error: `Invitation email is not configured: missing ${missingAdmin.join(', ')} in Vercel.` }, { status: 503 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Invitation email is not configured: missing RESEND_API_KEY in Vercel.' }, { status: 503 });
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });
    const actor = await adminAuth().verifyIdToken(token);
    const { inviteId } = await request.json() as { inviteId?: string };
    if (!inviteId) return NextResponse.json({ error: 'Invitation is required.' }, { status: 400 });
    const db = adminDb();
    const inviteRef = db.collection('householdInvites').doc(inviteId);
    const invite = await inviteRef.get();
    if (!invite.exists) return NextResponse.json({ error: 'Invitation was not found.' }, { status: 404 });
    const data = invite.data()!;
    if (data.createdBy !== actor.uid || data.status !== 'pending') return NextResponse.json({ error: 'You cannot send this invitation.' }, { status: 403 });
    const household = await db.collection('households').doc(data.householdId).get();
    if (!household.exists || household.data()?.ownerId !== actor.uid) return NextResponse.json({ error: 'You do not own this household.' }, { status: 403 });
    const apiKey = process.env.RESEND_API_KEY!;
    const baseUrl = process.env.APP_URL || request.nextUrl.origin;
    const acceptUrl = `${baseUrl}/dashboard/profile?invite=${encodeURIComponent(inviteId)}`;
    const resend = new Resend(apiKey);
    const delivery = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'SmartJib <onboarding@resend.dev>',
      to: data.email,
      subject: `You are invited to ${household.data()?.name || 'a SmartJib household'}`,
      html: `<p>Hello,</p><p>You were invited to join <strong>${household.data()?.name || 'a household'}</strong> as a <strong>${data.role}</strong>.</p><p><a href="${acceptUrl}">Accept invitation</a></p><p>This invitation expires in 14 days.</p>`,
    });
    if (delivery.error) return NextResponse.json({ error: `Resend rejected the invitation: ${delivery.error.message}` }, { status: 502 });
    await inviteRef.update({ emailSentAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Household invitation email failed', error);
    return NextResponse.json({ error: 'Unable to send invitation email.' }, { status: 500 });
  }
}
