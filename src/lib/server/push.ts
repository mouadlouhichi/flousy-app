/**
 * Web Push sender. VAPID keys are server-side only; the public key is also
 * exposed as NEXT_PUBLIC_VAPID_PUBLIC_KEY so the browser can subscribe.
 * Generate a pair once with `npx web-push generate-vapid-keys`.
 */
import type { StoredPushSubscription } from '@/lib/reminders';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PRIVATE_KEY
    && (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY),
  );
}

export type PushResult = 'sent' | 'gone' | 'failed' | 'not_configured';

export async function sendPush(subscription: StoredPushSubscription, payload: PushPayload): Promise<PushResult> {
  if (!isPushConfigured()) return 'not_configured';
  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || `mailto:${process.env.CONTACT_TO_EMAIL || 'hello@flousy.app'}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12, urgency: 'normal' },
    );
    return 'sent';
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    // 404/410 = subscription expired or revoked: caller should drop it.
    if (status === 404 || status === 410) return 'gone';
    return 'failed';
  }
}
