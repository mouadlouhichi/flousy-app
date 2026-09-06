import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { timingSafeEqual } from 'node:crypto';
import en from '../../../../../messages/en.json';
import fr from '../../../../../messages/fr.json';
import ar from '../../../../../messages/ar.json';
import { formatMessage, type Language, type Messages } from '@/lib/i18n-core';
import { getAdminFirestore, isAdminConfigured } from '@/lib/server/firebase-admin';
import { isPushConfigured, sendPush } from '@/lib/server/push';
import {
  normalizeReminderPrefs,
  planReminders,
  type ReminderCopy,
  type StoredPushSubscription,
} from '@/lib/reminders';
import { resolveProEntitlement } from '@/lib/pro-features';
import { normalizeMonth, type MonthBudget, type SavingGoal, type UserProfile } from '@/lib/store';
import { getCurrentMonthKey } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MESSAGES: Record<Language, Messages> = { en, fr, ar };

/**
 * Scheduled reminder dispatcher (call hourly from Vercel Cron / GitHub
 * Actions / any scheduler with `Authorization: Bearer $CRON_SECRET`).
 *
 * For every profile that opted into reminders and whose local hour matches
 * `reminderPrefs.hour`, compute today's reminders with the same pure planner
 * the client uses, then deliver them through Web Push (every registered
 * device) and, when enabled, one email digest. Requires the Admin SDK
 * (FIREBASE_SERVICE_ACCOUNT_JSON); without it the route answers 503 and the
 * in-app local notifications remain the only channel.
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function localHour(timezone: string | undefined, now: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone || 'Africa/Casablanca' })
      .formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    return Number.isFinite(hour) ? hour % 24 : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
}

function currencyFormatter(currency: string, locale: string) {
  try {
    const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
    return (value: number) => fmt.format(value);
  } catch {
    return (value: number) => `${value.toFixed(2)} ${currency}`;
  }
}

function copyFor(language: Language): ReminderCopy {
  const m = MESSAGES[language].reminders;
  return {
    billTitle: m.billTitle,
    billToday: (name, amount) => formatMessage(m.billToday, { name, amount }),
    billTomorrow: (name, amount) => formatMessage(m.billTomorrow, { name, amount }),
    billInDays: (name, amount, days) => formatMessage(m.billInDays, { name, amount, days }),
    goalTitle: m.goalTitle,
    goalBody: (name, percent) => formatMessage(m.goalBody, { name, percent }),
    trialTitle: m.trialTitle,
    trialBody: (days) => formatMessage(m.trialBody, { days }),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function GET() {
  return NextResponse.json({
    configured: isAdminConfigured() && Boolean(process.env.CRON_SECRET),
    push: isPushConfigured(),
    email: Boolean(process.env.RESEND_API_KEY),
  });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  const db = await getAdminFirestore();
  if (!db) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }

  const now = new Date();
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const from = process.env.RESEND_FROM_EMAIL || '';
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://flousy.app').replace(/\/$/, '');

  const snapshot = await db.collection('users').where('reminderPrefs.billsEnabled', '==', true).limit(2000).get();
  const stats = { users: 0, planned: 0, pushSent: 0, pushDropped: 0, emails: 0, skipped: 0 };

  for (const doc of snapshot.docs) {
    const profile = doc.data() as UserProfile & { email?: string };
    const prefs = normalizeReminderPrefs(profile.reminderPrefs);
    if (localHour(profile.timezone, now) !== prefs.hour) {
      stats.skipped += 1;
      continue;
    }
    const entitlement = resolveProEntitlement(profile, now.getTime());
    if (!entitlement.isPro) {
      stats.skipped += 1;
      continue;
    }
    stats.users += 1;

    const language: Language = profile.language === 'fr' || profile.language === 'ar' ? profile.language : 'en';
    const locale = language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-MA' : 'en-GB';
    const monthKey = getCurrentMonthKey(profile.monthStartDate, now);
    const [monthSnap, savingsSnap] = await Promise.all([
      db.doc(`users/${doc.id}/months/${monthKey}`).get(),
      db.doc(`users/${doc.id}/data/savings`).get(),
    ]);
    if (!monthSnap.exists) continue;
    const month = normalizeMonth(monthSnap.data() as Partial<MonthBudget>, monthKey, profile);
    const goals = ((savingsSnap.data()?.goals as SavingGoal[] | undefined) || []);
    const format = currencyFormatter(month.currency || profile.currency || 'MAD', locale);

    const reminders = planReminders(month, goals, prefs, copyFor(language), format, {
      today: now,
      trialDaysLeft: entitlement.status === 'trialing' ? entitlement.daysRemaining : null,
    });
    if (reminders.length === 0) continue;
    stats.planned += reminders.length;
    if (dryRun) continue;

    // Push to every device; drop subscriptions the push service says are gone.
    const subscriptions: StoredPushSubscription[] = Array.isArray(profile.pushSubscriptions) ? profile.pushSubscriptions : [];
    const alive: StoredPushSubscription[] = [];
    for (const subscription of subscriptions) {
      let keep = true;
      for (const reminder of reminders) {
        const result = await sendPush(subscription, {
          title: reminder.title,
          body: reminder.body,
          url: reminder.url,
          tag: reminder.id,
        });
        if (result === 'sent') stats.pushSent += 1;
        if (result === 'gone') {
          keep = false;
          break;
        }
      }
      if (keep) alive.push(subscription);
      else stats.pushDropped += 1;
    }
    if (alive.length !== subscriptions.length) {
      await doc.ref.update({ pushSubscriptions: alive }).catch(() => {});
    }

    if (prefs.emailDigest && resend && from && profile.email) {
      const items = reminders.map((r) => `<li><strong>${escapeHtml(r.title)}</strong> — ${escapeHtml(r.body)}</li>`).join('');
      await resend.emails.send({
        from,
        to: profile.email,
        subject: `SmartJib · ${MESSAGES[language].reminders.title}`,
        html: `<div dir="${language === 'ar' ? 'rtl' : 'ltr'}" style="font-family:sans-serif;font-size:15px;line-height:1.5"><ul>${items}</ul><p><a href="${appUrl}/dashboard/fixed">${escapeHtml(appUrl)}</a></p></div>`,
      }).then(() => { stats.emails += 1; }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, dryRun, at: now.toISOString(), ...stats });
}
