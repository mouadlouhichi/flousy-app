import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebase-id-token';
import { isRateLimited } from '@/lib/server/rate-limit';
import { isPushConfigured, sendPush } from '@/lib/server/push';
import type { StoredPushSubscription } from '@/lib/reminders';

export const runtime = 'nodejs';

/**
 * GET  → readiness: is Web Push configured on this deployment?
 * POST → send a *test* notification to the subscription the caller just
 *        created in their own browser. The subscription is echoed back by
 *        the client (it is the caller's own device); the route only needs
 *        proof of a signed-in user so it cannot be used as an anonymous
 *        push relay.
 */
export function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
  });
}

function isSubscription(value: unknown): value is StoredPushSubscription {
  const v = value as StoredPushSubscription | null;
  return Boolean(
    v && typeof v.endpoint === 'string' && v.endpoint.startsWith('https://')
    && v.keys && typeof v.keys.p256dh === 'string' && typeof v.keys.auth === 'string',
  );
}

export async function POST(request: NextRequest) {
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!projectId || !token) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  const verified = await verifyFirebaseIdToken(token, { projectId, apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY });
  if (!('uid' in verified)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  if (await isRateLimited('push-test', verified.uid, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  let body: { subscription?: unknown; title?: unknown; body?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }
  if (!isSubscription(body.subscription)) {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }
  const result = await sendPush(body.subscription, {
    title: typeof body.title === 'string' ? body.title.slice(0, 80) : 'SmartJib',
    body: typeof body.body === 'string' ? body.body.slice(0, 200) : '',
    url: '/dashboard/profile/reminders',
    tag: `test:${Date.now()}`,
  });
  return NextResponse.json({ ok: result === 'sent', result }, { status: result === 'sent' ? 200 : 502 });
}
