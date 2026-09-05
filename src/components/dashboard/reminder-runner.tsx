'use client';

import { useEffect, useMemo } from 'react';
import { useDashboard } from './dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { isProFeatureUnlocked } from '@/lib/household';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { resolveProEntitlement } from '@/lib/pro-features';
import { getUpcomingBills } from '@/lib/store';
import {
  detectNotificationSupport,
  filterUnshown,
  normalizeReminderPrefs,
  planReminders,
  showLocalNotification,
  type ReminderCopy,
} from '@/lib/reminders';

/**
 * Fires today's reminders as local notifications while the app is open or
 * installed. Server push (Android/desktop when the app is closed) is handled
 * by /api/reminders/dispatch; both use the same `planReminders` so the user
 * never sees a reminder twice thanks to identical tags.
 */
export function ReminderRunner() {
  const { month, goals, profile, isPro } = useDashboard();
  const { workspace, household } = useHousehold();
  const { format } = useCurrency();
  const { messages: m, t } = useLanguage();
  const unlocked = isProFeatureUnlocked(isPro, workspace, household);

  const copy = useMemo<ReminderCopy>(() => ({
    billTitle: m.reminders.billTitle,
    billToday: (name, amount) => t(m.reminders.billToday, { name, amount }),
    billTomorrow: (name, amount) => t(m.reminders.billTomorrow, { name, amount }),
    billInDays: (name, amount, days) => t(m.reminders.billInDays, { name, amount, days }),
    goalTitle: m.reminders.goalTitle,
    goalBody: (name, percent) => t(m.reminders.goalBody, { name, percent }),
    trialTitle: m.reminders.trialTitle,
    trialBody: (days) => t(m.reminders.trialBody, { days }),
  }), [m.reminders, t]);

  useEffect(() => {
    if (!unlocked || !profile) return;
    if (detectNotificationSupport() !== 'granted') return;
    const prefs = normalizeReminderPrefs(profile.reminderPrefs);
    if (!prefs.billsEnabled && !prefs.goalsEnabled) return;

    const run = () => {
      const today = new Date();
      const entitlement = resolveProEntitlement(profile, today.getTime());
      const planned = planReminders(month, goals, prefs, copy, format, {
        today,
        trialDaysLeft: entitlement.status === 'trialing' ? entitlement.daysRemaining : null,
      });
      const fresh = filterUnshown(planned, window.localStorage, today.toISOString().slice(0, 10));
      fresh.forEach((reminder) => void showLocalNotification(reminder));
    };

    run();
    // Re-check when the tab comes back into view (day may have changed) and
    // on a slow interval while it stays open.
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(run, 30 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [copy, format, goals, month, profile, unlocked]);

  // App icon badge (installed PWA on Chromium/Windows/macOS/Android): number
  // of bills due within the next 3 days. Cleared when there is nothing due or
  // when reminders are off so a stale count never lingers on the icon.
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge || !nav.clearAppBadge) return;
    const billsOn = unlocked && !!profile && normalizeReminderPrefs(profile.reminderPrefs).billsEnabled;
    const due = billsOn ? getUpcomingBills(month, 3).length : 0;
    (due > 0 ? nav.setAppBadge(due) : nav.clearAppBadge()).catch(() => { /* not installed */ });
  }, [month, profile, unlocked]);

  return null;
}
