'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n-context';
import { useHousehold } from '@/lib/household-context';
import { isProFeatureUnlocked } from '@/lib/household';
import { useCurrency } from '@/lib/currency-context';
import { useDashboard } from '../dashboard-provider';
import { trackEvent } from '@/lib/analytics';
import {
  currentPushEndpoint,
  detectNotificationSupport,
  isStandalonePwa,
  normalizeReminderPrefs,
  subscribeToPush,
  unsubscribeFromPush,
  type NotificationSupport,
  type ReminderPrefs,
} from '@/lib/reminders';
import { UpcomingPaymentsCalendar } from '../upcoming-payments-calendar';

const LEAD_OPTIONS: Array<{ days: number; key: 'lead0' | 'lead1' | 'lead3' | 'lead7' }> = [
  { days: 0, key: 'lead0' },
  { days: 1, key: 'lead1' },
  { days: 3, key: 'lead3' },
  { days: 7, key: 'lead7' },
];

export function RemindersPanel() {
  const { user, profile, updateProfileData } = useAuth();
  const { isPro, openProModal, month } = useDashboard();
  const { workspace, household } = useHousehold();
  const { messages: m, t } = useLanguage();
  const { format } = useCurrency();
  const r = m.reminders;
  const unlocked = isProFeatureUnlocked(isPro, workspace, household);

  const prefs = useMemo(() => normalizeReminderPrefs(profile?.reminderPrefs), [profile?.reminderPrefs]);
  const [support, setSupport] = useState<NotificationSupport>('unsupported');
  const [pushConfigured, setPushConfigured] = useState<boolean | null>(null);
  const [vapidKey, setVapidKey] = useState<string>('');
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setSupport(detectNotificationSupport());
    void currentPushEndpoint().then(setThisEndpoint);
    fetch('/api/push', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { configured?: boolean; publicKey?: string | null }) => {
        setPushConfigured(Boolean(data.configured));
        setVapidKey(data.publicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '');
      })
      .catch(() => setPushConfigured(false));
  }, []);

  const savePrefs = async (patch: Partial<ReminderPrefs>) => {
    if (!profile) return;
    const next = normalizeReminderPrefs({ ...prefs, ...patch });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await updateProfileData({
      reminderPrefs: next,
      timezone,
      ...(next.emailDigest && user?.email ? { email: user.email } : {}),
    });
    setNotice(r.saved);
    window.setTimeout(() => setNotice(null), 2000);
  };

  const toggleLead = (days: number) => {
    const set = new Set(prefs.billLeadDays);
    if (set.has(days)) set.delete(days);
    else set.add(days);
    void savePrefs({ billLeadDays: Array.from(set) });
  };

  const subscriptions = profile?.pushSubscriptions || [];
  const thisDeviceSubscribed = Boolean(thisEndpoint && subscriptions.some((s) => s.endpoint === thisEndpoint));

  const enablePush = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      // Permission is requested even when server push is unconfigured so the
      // in-app local notifications can fire.
      if (!vapidKey) {
        await Notification.requestPermission();
        setSupport(detectNotificationSupport());
        return;
      }
      const subscription = await subscribeToPush(vapidKey);
      setSupport(detectNotificationSupport());
      if (!subscription) return;
      const others = subscriptions.filter((s) => s.endpoint !== subscription.endpoint);
      await updateProfileData({ pushSubscriptions: [...others, subscription].slice(-10) });
      setThisEndpoint(subscription.endpoint);
      trackEvent('push_enabled');
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async (endpoint?: string) => {
    if (!profile) return;
    setBusy(true);
    try {
      const target = endpoint ?? (await unsubscribeFromPush()) ?? thisEndpoint;
      if (!endpoint) setThisEndpoint(null);
      await updateProfileData({ pushSubscriptions: subscriptions.filter((s) => s.endpoint !== target) });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    const mine = subscriptions.find((s) => s.endpoint === thisEndpoint);
    if (!mine || !user) return;
    setBusy(true);
    try {
      const idToken = await user.getIdToken().catch(() => null);
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ subscription: mine, title: r.billTitle, body: t(r.billInDays, { name: 'Test', amount: format(100), days: 3 }) }),
      });
      if (res.ok) {
        setNotice(r.testSent);
        window.setTimeout(() => setNotice(null), 2500);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!unlocked) {
    return (
      <section className="flex flex-col gap-4">
        <div className="rounded-3xl border border-outline-variant bg-surface-container p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <AppIcon name="notifications_active" className="text-[22px]" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-on-surface">{r.title}</h3>
              <p className="mt-1 text-sm text-on-surface-variant">{m.profile.pro.features.reminders.description}</p>
              <button
                type="button"
                onClick={openProModal}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary"
              >
                <AppIcon name="workspace_premium" className="text-[16px]" />
                {m.insights.unlock}
              </button>
            </div>
          </div>
        </div>
        <UpcomingPaymentsCalendar month={month} />
      </section>
    );
  }

  const pushStatus = (() => {
    if (support === 'unsupported') return { text: r.pushUnsupported, icon: 'block', tone: 'text-on-surface-variant' };
    if (support === 'ios-needs-install' || (!isStandalonePwa() && /iPhone|iPad/i.test(navigator.userAgent) && support !== 'granted')) {
      return { text: r.pushIosInstall, icon: 'ios_share', tone: 'text-on-surface-variant' };
    }
    if (support === 'denied') return { text: r.pushDenied, icon: 'notifications_off', tone: 'text-error' };
    if (pushConfigured === false) return { text: r.pushNotConfigured, icon: 'info', tone: 'text-on-surface-variant' };
    return null;
  })();

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-3xl border border-outline-variant bg-surface-container p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <AppIcon name="notifications_active" className="text-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-on-surface">{r.title}</h3>
            <p className="mt-1 text-sm text-on-surface-variant">{r.description}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-on-surface">{r.billsToggle}</span>
            <Switch checked={prefs.billsEnabled} onCheckedChange={(v) => void savePrefs({ billsEnabled: v })} />
          </label>
          {prefs.billsEnabled && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-on-surface-variant">{r.leadDays}</span>
              <div className="flex flex-wrap justify-end gap-1.5">
                {LEAD_OPTIONS.map((option) => {
                  const active = prefs.billLeadDays.includes(option.days);
                  return (
                    <button
                      key={option.days}
                      type="button"
                      onClick={() => toggleLead(option.days)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                        active ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {r[option.key]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-on-surface">{r.goalsToggle}</span>
            <Switch checked={prefs.goalsEnabled} onCheckedChange={(v) => void savePrefs({ goalsEnabled: v })} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <AppIcon name="mail" className="text-[18px] text-primary" />
              {r.emailToggle}
            </span>
            <Switch checked={prefs.emailDigest} onCheckedChange={(v) => void savePrefs({ emailDigest: v })} />
          </label>
          {notice && <p className="text-xs font-semibold text-primary">{notice}</p>}
        </div>
      </div>

      <div className="rounded-3xl border border-outline-variant bg-surface-container p-5">
        <h3 className="flex items-center gap-2 font-bold text-on-surface">
          <AppIcon name="phone_iphone" className="text-[20px] text-primary" />
          {r.pushTitle}
        </h3>
        {pushStatus ? (
          <p className={`mt-2 flex items-start gap-2 text-sm ${pushStatus.tone}`}>
            <AppIcon name={pushStatus.icon} className="mt-0.5 text-[16px]" />
            {pushStatus.text}
          </p>
        ) : null}
        {support !== 'unsupported' && support !== 'denied' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {thisDeviceSubscribed || (support === 'granted' && !vapidKey) ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                  <AppIcon name="check_circle" className="text-[14px]" />
                  {r.pushEnabled}
                </span>
                {thisDeviceSubscribed && (
                  <>
                    <button type="button" onClick={() => void sendTest()} disabled={busy} className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface">
                      {r.test}
                    </button>
                    <button type="button" onClick={() => void disablePush()} disabled={busy} className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-bold text-error">
                      {r.pushDisable}
                    </button>
                  </>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => void enablePush()}
                disabled={busy}
                className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-50"
              >
                {r.pushEnable}
              </button>
            )}
          </div>
        )}
        {subscriptions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{r.devices}</p>
            <ul className="mt-2 divide-y divide-outline-variant/60">
              {subscriptions.map((sub) => (
                <li key={sub.endpoint} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-on-surface">
                    <AppIcon name="devices" className="text-[16px] text-on-surface-variant" />
                    {sub.label}
                    {sub.endpoint === thisEndpoint && <span className="text-[10px] font-bold text-primary">•</span>}
                  </span>
                  <button type="button" onClick={() => void disablePush(sub.endpoint)} className="text-xs font-bold text-error">
                    {r.remove}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <UpcomingPaymentsCalendar month={month} />
    </section>
  );
}
