/**
 * Reminders — pure planning for bill / goal / trial notifications plus the
 * browser-side Web Push subscription helpers.
 *
 * Delivery channels:
 *  - `local`: `Notification` API fired from the open tab / installed PWA
 *    (no server, works everywhere incl. iOS home-screen apps ≥ 16.4);
 *  - `push`: Web Push subscription stored on the user's profile
 *    (`pushSubscriptions`) and delivered by `/api/reminders/dispatch`
 *    (Android/desktop; iOS only when installed);
 *  - `email`: daily digest via Resend from the same dispatch route.
 *
 * Preferences live on the profile (`reminderPrefs`) so every device agrees.
 */
import { type MonthBudget, type SavingGoal, getUpcomingBills } from './store';

export interface ReminderPrefs {
  billsEnabled: boolean;
  /** Days before due date to remind (e.g. [3, 1, 0]). */
  billLeadDays: number[];
  goalsEnabled: boolean;
  emailDigest: boolean;
  /** Local hour (0–23) the daily check should fire at. */
  hour: number;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  billsEnabled: true,
  billLeadDays: [3, 1, 0],
  goalsEnabled: true,
  emailDigest: false,
  hour: 9,
};

export function normalizeReminderPrefs(input: Partial<ReminderPrefs> | null | undefined): ReminderPrefs {
  const leads = Array.isArray(input?.billLeadDays)
    ? Array.from(new Set(input!.billLeadDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 14))).sort((a, b) => b - a)
    : DEFAULT_REMINDER_PREFS.billLeadDays;
  const hour = Number.isInteger(input?.hour) && input!.hour! >= 0 && input!.hour! <= 23
    ? input!.hour!
    : DEFAULT_REMINDER_PREFS.hour;
  return {
    billsEnabled: input?.billsEnabled ?? DEFAULT_REMINDER_PREFS.billsEnabled,
    billLeadDays: leads.length ? leads : DEFAULT_REMINDER_PREFS.billLeadDays,
    goalsEnabled: input?.goalsEnabled ?? DEFAULT_REMINDER_PREFS.goalsEnabled,
    emailDigest: input?.emailDigest ?? DEFAULT_REMINDER_PREFS.emailDigest,
    hour,
  };
}

export interface PlannedReminder {
  /** Stable id so the same reminder is never shown twice on one day. */
  id: string;
  kind: 'bill' | 'goal' | 'trial';
  title: string;
  body: string;
  /** Deep link inside the dashboard. */
  url: string;
  daysUntil: number;
}

export interface ReminderCopy {
  billToday: (name: string, amount: string) => string;
  billTomorrow: (name: string, amount: string) => string;
  billInDays: (name: string, amount: string, days: number) => string;
  billTitle: string;
  goalTitle: string;
  goalBody: (name: string, percent: number) => string;
  trialTitle: string;
  trialBody: (days: number) => string;
}

/**
 * Compute today's reminders from the month + goals + prefs. Pure so the
 * client (local notifications) and the server dispatcher agree on what gets
 * sent. `todayKey` (YYYY-MM-DD) makes the ids unique per day.
 */
export function planReminders(
  month: MonthBudget,
  goals: SavingGoal[],
  prefs: ReminderPrefs,
  copy: ReminderCopy,
  formatAmount: (value: number) => string,
  options: { today?: Date; trialDaysLeft?: number | null } = {},
): PlannedReminder[] {
  const today = options.today ?? new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const out: PlannedReminder[] = [];

  if (prefs.billsEnabled) {
    const maxLead = Math.max(0, ...prefs.billLeadDays);
    for (const bill of getUpcomingBills(month, maxLead, today)) {
      if (!prefs.billLeadDays.includes(bill.daysUntil)) continue;
      const amount = formatAmount(bill.remaining);
      const body = bill.daysUntil === 0
        ? copy.billToday(bill.name, amount)
        : bill.daysUntil === 1
          ? copy.billTomorrow(bill.name, amount)
          : copy.billInDays(bill.name, amount, bill.daysUntil);
      out.push({
        id: `bill:${bill.id}:${bill.date}:${bill.daysUntil}`,
        kind: 'bill',
        title: copy.billTitle,
        body,
        url: '/dashboard/fixed',
        daysUntil: bill.daysUntil,
      });
    }
  }

  if (prefs.goalsEnabled) {
    for (const goal of goals) {
      if (!goal.active || goal.target <= 0) continue;
      const pct = Math.floor((goal.current / goal.target) * 100);
      if (pct >= 90 && pct < 100) {
        out.push({
          id: `goal:${goal.id}:${todayKey}`,
          kind: 'goal',
          title: copy.goalTitle,
          body: copy.goalBody(goal.name, pct),
          url: '/dashboard/savings',
          daysUntil: 0,
        });
      }
    }
  }

  const trialDays = options.trialDaysLeft;
  if (typeof trialDays === 'number' && [7, 3, 1].includes(trialDays)) {
    out.push({
      id: `trial:${trialDays}:${todayKey}`,
      kind: 'trial',
      title: copy.trialTitle,
      body: copy.trialBody(trialDays),
      url: '/dashboard/profile/pro',
      daysUntil: trialDays,
    });
  }

  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

/* ------------------------------------------------------------------------ */
/* Browser capability + Web Push subscription                                */
/* ------------------------------------------------------------------------ */

export type NotificationSupport = 'unsupported' | 'ios-needs-install' | 'denied' | 'default' | 'granted';

export function detectNotificationSupport(): NotificationSupport {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    // iOS Safari in a tab exposes no Notification API; installed it does.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    return isIos ? 'ios-needs-install' : 'unsupported';
  }
  if (!('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission as NotificationSupport;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export interface StoredPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** Browser label so the user can recognise and revoke a device. */
  label: string;
  createdAt: string;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Device';
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Web';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${browser} · ${os}`;
}

/** Ask permission and subscribe this browser to Web Push (needs the VAPID public key). */
export async function subscribeToPush(vapidPublicKey: string): Promise<StoredPushSubscription | null> {
  if (detectNotificationSupport() === 'unsupported' || !vapidPublicKey) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? (await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    label: deviceLabel(),
    createdAt: new Date().toISOString(),
  };
}

export async function unsubscribeFromPush(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}

export async function currentPushEndpoint(): Promise<string | null> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription?.endpoint ?? null;
  } catch {
    return null;
  }
}

/** Fire a notification from the page via the service worker (works when installed on iOS). */
export async function showLocalNotification(reminder: PlannedReminder): Promise<boolean> {
  if (detectNotificationSupport() !== 'granted') return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(reminder.title, {
      body: reminder.body,
      tag: reminder.id,
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
      data: { url: reminder.url },
    });
    return true;
  } catch {
    return false;
  }
}

const SHOWN_KEY = 'flousy_reminders_shown';

/** Remember which reminder ids were already shown today (device-local). */
export function filterUnshown(reminders: PlannedReminder[], store: Pick<Storage, 'getItem' | 'setItem'> | null, todayKey: string): PlannedReminder[] {
  if (!store) return reminders;
  let state: { day: string; ids: string[] } = { day: todayKey, ids: [] };
  try {
    const parsed = JSON.parse(store.getItem(SHOWN_KEY) || 'null');
    if (parsed && parsed.day === todayKey && Array.isArray(parsed.ids)) state = parsed;
  } catch { /* fresh state */ }
  const fresh = reminders.filter((r) => !state.ids.includes(r.id));
  if (fresh.length) {
    store.setItem(SHOWN_KEY, JSON.stringify({ day: todayKey, ids: [...state.ids, ...fresh.map((r) => r.id)] }));
  }
  return fresh;
}
