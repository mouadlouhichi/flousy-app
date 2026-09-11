'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useHousehold } from '@/lib/household-context';
import { AMOUNT_AREA } from '@/lib/household-rbac';
import { markUserNotificationsRead, subscribeUserNotifications } from '@/lib/db';
import { countUnreadNotifications, unreadNotificationIds, type UserNotification } from '@/lib/notifications';
import { MonthBudget, SavingGoal, calculateEnvelopeAmounts, calculateEnvelopeSpent, calculateCategorySpent, getUpcomingBills } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { formatLocalizedPercent } from '@/lib/i18n';
import { localizeCategoryName, localizeHouseholdRole } from '@/lib/localized-labels';

const READ_REMINDERS_KEY = 'smartjib_read_reminders';

interface BudgetAlertsProps {
  month: MonthBudget;
  /** Active savings goals, for the near-complete milestone reminder. */
  goals?: SavingGoal[];
  /** Effective Pro entitlement, for the trial-countdown reminder. */
  entitlement?: { status: string; daysRemaining: number; endsAtMs: number | null } | null;
}

export function BudgetAlerts({ month, goals = [], entitlement }: BudgetAlertsProps) {
  const { format } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const percent = (value: number) => formatLocalizedPercent(value, intlLocale);
  const { pendingInvites, canViewArea } = useHousehold();
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // ── Database-backed inbox: server-written notification rows the client
  // reads live and marks read. Empty when Firebase is not configured (demo
  // mode), so local-only alerts keep working unchanged. ──
  const [dbNotifications, setDbNotifications] = useState<UserNotification[]>([]);
  useEffect(() => subscribeUserNotifications(user?.uid, setDbNotifications), [user?.uid]);
  const dbUnread = countUnreadNotifications(dbNotifications);
  const openDbNotification = async (notification: UserNotification) => {
    if (user && notification.readAt == null) {
      await markUserNotificationsRead(user.uid, [notification.id], Date.now()).catch(() => {});
    }
    setIsOpen(false);
    if (notification.href) router.push(notification.href);
  };
  const markAllDbRead = async () => {
    if (!user) return;
    await markUserNotificationsRead(user.uid, unreadNotificationIds(dbNotifications), Date.now()).catch(() => {});
  };
  const [seenBudgetKey, setSeenBudgetKey] = useState<string | null>(null);
  // Reminders the user has tapped. Persisted so a bill you already opened
  // stays greyed out across reloads until the reminder itself changes
  // (a new due-date window produces a new key).
  const [readReminders, setReadReminders] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(READ_REMINDERS_KEY) || '[]');
      if (Array.isArray(stored)) setReadReminders(stored.filter((k): k is string => typeof k === 'string'));
    } catch {
      /* ignore corrupt storage */
    }
  }, []);
  const markReminderRead = (key: string) => {
    setReadReminders((prev) => {
      if (prev.includes(key)) return prev;
      // Cap the list so the key never grows without bound.
      const next = [...prev, key].slice(-60);
      try {
        localStorage.setItem(READ_REMINDERS_KEY, JSON.stringify(next));
      } catch {
        /* storage full / private mode */
      }
      return next;
    });
  };

  // Every alert here quotes a spent-vs-budget figure, so the whole budget-health
  // list is an `expenses` concern. Household invitations are the member's own
  // business and stay visible either way.
  const canSeeSpending = canViewArea(AMOUNT_AREA.variableExpense);

  const { needs: needsCap, wants: wantsCap } = calculateEnvelopeAmounts(month.totalBudget, month.strategyId, month.customRatios);
  const { needs: needsSpent, wants: wantsSpent } = calculateEnvelopeSpent(month);

  const needsRatio = needsCap > 0 ? (needsSpent / needsCap) * 100 : 0;
  const wantsRatio = wantsCap > 0 ? (wantsSpent / wantsCap) * 100 : 0;

  const alerts: { title: string; message: string; severity: 'warning' | 'error' }[] = [];

  if (canSeeSpending && needsRatio >= 100) {
    alerts.push({
      title: m.alerts.needsExceeded,
      message: t(m.alerts.spentVsBudget, { spent: format(needsSpent), budget: format(needsCap), percent: percent(Math.round(needsRatio)) }),
      severity: 'error',
    });
  } else if (canSeeSpending && needsRatio >= 80) {
    alerts.push({
      title: m.alerts.needsAlert,
      message: t(m.alerts.spentOfBudget, { spent: format(needsSpent), budget: format(needsCap), percent: percent(Math.round(needsRatio)) }),
      severity: 'warning',
    });
  }

  if (canSeeSpending && wantsRatio >= 100) {
    alerts.push({
      title: m.alerts.wantsExceeded,
      message: t(m.alerts.spentVsBudget, { spent: format(wantsSpent), budget: format(wantsCap), percent: percent(Math.round(wantsRatio)) }),
      severity: 'error',
    });
  } else if (canSeeSpending && wantsRatio >= 80) {
    alerts.push({
      title: m.alerts.wantsAlert,
      message: t(m.alerts.spentOfBudget, { spent: format(wantsSpent), budget: format(wantsCap), percent: percent(Math.round(wantsRatio)) }),
      severity: 'warning',
    });
  }

  // Category-level alerts: only for categories where the user explicitly set
  // a budget limit (Pro). No implicit/default limits — spending in a category
  // without a user-defined budget never raises an alert. Thresholds mirror
  // the progress bar on the Variable Expenses screen (80% warn, 100% error).
  const categoryBudgets = month.categoryBudgets || {};

  Object.entries(categoryBudgets).forEach(([cat, budget]) => {
    if (!canSeeSpending || !budget || budget <= 0) return;

    const spent = calculateCategorySpent(month, cat);
    const pct = (spent / budget) * 100;

    if (pct >= 100) {
      alerts.push({
        title: t(m.alerts.categoryExceeded, { category: localizeCategoryName(cat, m) }),
        message: t(m.alerts.spentVsBudget, { spent: format(spent), budget: format(budget), percent: percent(Math.round(pct)) }),
        severity: 'error',
      });
    } else if (pct >= 80) {
      alerts.push({
        title: t(m.alerts.categoryAlert, { category: localizeCategoryName(cat, m) }),
        message: t(m.alerts.spentOfBudget, { spent: format(spent), budget: format(budget), percent: percent(Math.round(pct)) }),
        severity: 'warning',
      });
    }
  });

  const budgetAlertKey = `${month.updatedAt || ''}:${alerts.map((alert) => `${alert.title}:${alert.message}`).join('|')}`;
  const storedBudgetKey = typeof window === 'undefined' ? null : localStorage.getItem('smartjib_seen_budget_alerts');
  const hasUnreadBudgetAlerts = alerts.length > 0 && seenBudgetKey !== budgetAlertKey && storedBudgetKey !== budgetAlertKey;

  // ── Reminders: derived from data the app already holds ──
  // Bills due within 7 days (fixedBills is its own RBAC area), goals at ≥80%
  // of target, and a Pro trial ending within 14 days.
  const canSeeBills = canViewArea('fixedBills');
  const canSeeGoals = canViewArea(AMOUNT_AREA.savingsGoal);
  const upcomingBills = canSeeBills ? getUpcomingBills(month, 7) : [];
  const goalMilestones = canSeeGoals
    ? (goals || []).filter(
        (goal) =>
          goal.active &&
          goal.target > 0 &&
          goal.current >= goal.target * 0.8 &&
          goal.current < goal.target,
      )
    : [];
  const trialDaysLeft =
    entitlement &&
    entitlement.status === 'trialing' &&
    entitlement.endsAtMs &&
    entitlement.daysRemaining > 0 &&
    entitlement.daysRemaining <= 14
      ? entitlement.daysRemaining
      : null;

  const reminders: Array<{
    key: string;
    /**
     * Stable identity used for the "read" (grey) state. Unlike `key` it
     * does not change as the countdown ticks, so a bill you already opened
     * stays grey until its due date passes.
     */
    readKey: string;
    icon: string;
    title: string;
    /** Short "due" label rendered on the same row as the title. */
    message: string;
    tone: 'info' | 'warning';
    /** Where a tap takes the user. */
    href: string;
  }> = [];
  for (const bill of upcomingBills) {
    reminders.push({
      key: `bill-${bill.id}-${bill.daysUntil}`,
      readKey: `bill-${bill.id}-${bill.date}`,
      icon: 'event_upcoming',
      title: bill.name,
      message: bill.daysUntil === 0 ? m.alerts.billDueToday : t(m.alerts.billDueInDays, { days: bill.daysUntil }),
      tone: bill.daysUntil === 0 ? 'warning' : 'info',
      href: '/dashboard/fixed',
    });
  }
  for (const goal of goalMilestones) {
    reminders.push({
      key: `goal-${goal.id}-${Math.floor(goal.current)}`,
      readKey: `goal-${goal.id}-${Math.floor(goal.current)}`,
      icon: 'flag',
      title: goal.name,
      message: t(m.alerts.goalNear, { percent: percent(Math.round((goal.current / goal.target) * 100)) }),
      tone: 'info',
      href: '/dashboard/savings',
    });
  }
  if (trialDaysLeft !== null) {
    reminders.push({
      key: `trial-${trialDaysLeft}`,
      readKey: `trial-${entitlement?.endsAtMs ?? 'trial'}`,
      icon: 'hourglass_top',
      title: m.alerts.trialEndingTitle,
      message: t(m.alerts.trialEndingDays, { days: trialDaysLeft }),
      tone: 'warning',
      href: '/dashboard/profile/pro',
    });
  }
  const openReminder = (reminder: (typeof reminders)[number]) => {
    markReminderRead(reminder.readKey);
    setIsOpen(false);
    router.push(reminder.href);
  };

  const reminderKey = reminders.map((reminder) => reminder.key).join('|');
  const storedReminderKey = typeof window === 'undefined' ? null : localStorage.getItem('smartjib_seen_reminders');
  const [seenReminderKey, setSeenReminderKey] = useState<string | null>(null);
  const hasUnreadReminders =
    reminders.length > 0 && seenReminderKey !== reminderKey && storedReminderKey !== reminderKey;

  const hasUnreadNotifications =
    hasUnreadBudgetAlerts || hasUnreadReminders || pendingInvites.length > 0 || dbUnread > 0;
  const openNotifications = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen && alerts.length > 0) {
      localStorage.setItem('smartjib_seen_budget_alerts', budgetAlertKey);
      setSeenBudgetKey(budgetAlertKey);
    }
    if (nextOpen && reminders.length > 0) {
      localStorage.setItem('smartjib_seen_reminders', reminderKey);
      setSeenReminderKey(reminderKey);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openNotifications}
        aria-expanded={isOpen}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
          isOpen
            ? 'bg-primary text-on-primary'
            : 'text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface'
        }`}
        aria-label={t(m.alerts.viewNotifications, { count: alerts.length + pendingInvites.length + reminders.length + dbNotifications.length })}
      >
        <AppIcon name="notifications" className="text-[22px]" />
        {hasUnreadNotifications && (
          <span className="absolute top-1.5 end-1.5 h-2.5 w-2.5 rounded-full bg-error ring-2 ring-surface animate-pulse" />
        )}
      </button>

      {isOpen && (
        // On phones the anchored 320px popover spills off the left edge of the
        // screen, so it is pinned as a full-width sheet below the sticky
        // header; from `sm` up it keeps the original anchored popover.
        <div className="fixed inset-x-3 top-[72px] z-50 rounded-[1.75rem] border border-outline-variant bg-surface-container-lowest shadow-floating p-4 max-h-[calc(100dvh-88px)] overflow-y-auto sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:w-[22rem] sm:max-h-[70vh]">
          <div className="flex justify-between items-center pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-forest text-lime">
                <AppIcon name="notifications" className="text-[16px]" />
              </span>
              <h4 className="text-[15px] font-semibold text-on-surface">{m.alerts.title}</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="tap-target flex size-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              aria-label={m.common.close}
            >
              <AppIcon name="close" className="text-[16px]" />
            </button>
          </div>

          <div className="space-y-3 mt-3">
            {dbNotifications.length > 0 && (
              <div className="space-y-1.5 border-b border-outline-variant pb-3">
                <div className="flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">{m.alerts.inbox}</p>
                  {dbUnread > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllDbRead()}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      {m.alerts.markAllRead}
                    </button>
                  )}
                </div>
                <ul className="flex flex-col gap-1">
                  {dbNotifications.map((notification) => {
                    const isRead = notification.readAt != null;
                    return (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => void openDbNotification(notification)}
                          className={`group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-start transition-colors ${
                            isRead
                              ? 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                              : 'bg-lime/35 text-on-surface hover:bg-lime/55 dark:bg-lime/10 dark:hover:bg-lime/20'
                          }`}
                        >
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                              isRead
                                ? 'bg-surface-container-highest text-on-surface-variant'
                                : notification.severity === 'error'
                                  ? 'bg-error/15 text-error'
                                  : notification.severity === 'warning'
                                    ? 'bg-warning/15 text-warning'
                                    : 'bg-forest text-lime'
                            }`}
                          >
                            <AppIcon name={notification.icon} className="text-[17px]" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className={`truncate text-[13px] ${isRead ? 'font-medium' : 'font-semibold'}`}>
                              {notification.title}
                            </span>
                            <span className="truncate text-[11px] text-on-surface-variant">{notification.body}</span>
                          </span>
                          {notification.readAt == null && (
                            <span className="size-2 shrink-0 rounded-full bg-error" aria-hidden="true" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {pendingInvites.length > 0 && <div className="space-y-1.5 border-b border-outline-variant pb-3"><p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">{m.alerts.householdInvitations}</p>{pendingInvites.map((invite) => <Link key={invite.id} href={`/dashboard/profile?invite=${encodeURIComponent(invite.id)}`} onClick={() => setIsOpen(false)} className="block rounded-2xl bg-lime/35 p-2.5 text-sm text-on-surface hover:bg-lime/55 dark:bg-lime/10 dark:hover:bg-lime/20"><span className="font-bold">{m.alerts.householdInvitation}</span><span className="block text-xs text-on-surface-variant">{t(m.alerts.openToJoinAs, { role: localizeHouseholdRole(invite.role, m) })}</span></Link>)}</div>}

            {reminders.length > 0 && (
              <div className="space-y-1.5 border-b border-outline-variant pb-3">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">{m.alerts.reminders}</p>
                <ul className="flex flex-col gap-1">
                  {reminders.map((reminder) => {
                    const isRead = readReminders.includes(reminder.readKey);
                    return (
                      <li key={reminder.key}>
                        <button
                          type="button"
                          onClick={() => openReminder(reminder)}
                          data-read={isRead || undefined}
                          className={`group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-start transition-colors ${
                            isRead
                              ? 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                              : 'bg-lime/35 text-on-surface hover:bg-lime/55 dark:bg-lime/10 dark:hover:bg-lime/20'
                          }`}
                        >
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                              isRead
                                ? 'bg-surface-container-highest text-on-surface-variant'
                                : reminder.tone === 'warning'
                                  ? 'bg-warning/15 text-warning'
                                  : 'bg-forest text-lime'
                            }`}
                          >
                            <AppIcon name={reminder.icon} className="text-[17px]" />
                          </span>
                          {/* Title and due label share one row; the title yields first. */}
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <span className={`min-w-[6.5rem] flex-1 truncate text-[13px] ${isRead ? 'font-medium' : 'font-semibold'}`}>
                              {reminder.title}
                            </span>
                            <span
                              className={`max-w-[55%] shrink text-end text-[11px] font-semibold leading-tight ${
                                isRead
                                  ? 'text-on-surface-variant'
                                  : reminder.tone === 'warning'
                                    ? 'text-warning'
                                    : 'text-forest dark:text-lime'
                              }`}
                            >
                              {reminder.message}
                            </span>
                          </span>
                          <AppIcon
                            name="chevron_right"
                            className="shrink-0 text-[16px] text-on-surface-variant/60 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div className="space-y-1.5">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">{m.alerts.budgetHealth}</p>
              {alerts.length > 0 ? (
                alerts.map((a, idx) => (
                  <Alert key={idx} variant={a.severity === 'error' ? 'destructive' : 'warning'}>
                    <AppIcon name={a.severity === 'error' ? 'error' : 'warning'} />
                    <AlertTitle>{a.title}</AlertTitle>
                    <AlertDescription>{a.message}</AlertDescription>
                  </Alert>
                ))
              ) : (
                <p className="flex items-center gap-2 rounded-2xl bg-surface-container-low px-3 py-2.5 text-[12px] text-on-surface-variant">
                  <AppIcon name="check_circle" className="shrink-0 text-[16px] text-secondary" />
                  {m.alerts.allHealthy}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
