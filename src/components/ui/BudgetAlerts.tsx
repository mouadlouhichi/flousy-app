'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState } from 'react';
import Link from 'next/link';
import { useHousehold } from '@/lib/household-context';
import { MonthBudget, calculateEnvelopeAmounts, calculateEnvelopeSpent, calculateCategorySpent } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { formatLocalizedPercent } from '@/lib/i18n';
import { localizeCategoryName, localizeHouseholdRole } from '@/lib/localized-labels';

interface BudgetAlertsProps {
  month: MonthBudget;
}

export function BudgetAlerts({ month }: BudgetAlertsProps) {
  const { format } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const percent = (value: number) => formatLocalizedPercent(value, intlLocale);
  const { pendingInvites } = useHousehold();
  const [isOpen, setIsOpen] = useState(false);
  const [seenBudgetKey, setSeenBudgetKey] = useState<string | null>(null);

  const { needs: needsCap, wants: wantsCap } = calculateEnvelopeAmounts(month.totalBudget, month.strategyId, month.customRatios);
  const { needs: needsSpent, wants: wantsSpent } = calculateEnvelopeSpent(month);

  const needsRatio = needsCap > 0 ? (needsSpent / needsCap) * 100 : 0;
  const wantsRatio = wantsCap > 0 ? (wantsSpent / wantsCap) * 100 : 0;

  const alerts: { title: string; message: string; severity: 'warning' | 'error' }[] = [];

  if (needsRatio >= 100) {
    alerts.push({
      title: m.alerts.needsExceeded,
      message: t(m.alerts.spentVsBudget, { spent: format(needsSpent), budget: format(needsCap), percent: percent(Math.round(needsRatio)) }),
      severity: 'error',
    });
  } else if (needsRatio >= 80) {
    alerts.push({
      title: m.alerts.needsAlert,
      message: t(m.alerts.spentOfBudget, { spent: format(needsSpent), budget: format(needsCap), percent: percent(Math.round(needsRatio)) }),
      severity: 'warning',
    });
  }

  if (wantsRatio >= 100) {
    alerts.push({
      title: m.alerts.wantsExceeded,
      message: t(m.alerts.spentVsBudget, { spent: format(wantsSpent), budget: format(wantsCap), percent: percent(Math.round(wantsRatio)) }),
      severity: 'error',
    });
  } else if (wantsRatio >= 80) {
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
    if (!budget || budget <= 0) return;

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
  const storedBudgetKey = typeof window === 'undefined' ? null : localStorage.getItem('flousy_seen_budget_alerts');
  const hasUnreadBudgetAlerts = alerts.length > 0 && seenBudgetKey !== budgetAlertKey && storedBudgetKey !== budgetAlertKey;
  const hasUnreadNotifications = hasUnreadBudgetAlerts || pendingInvites.length > 0;
  const openNotifications = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen && alerts.length > 0) {
      localStorage.setItem('flousy_seen_budget_alerts', budgetAlertKey);
      setSeenBudgetKey(budgetAlertKey);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openNotifications}
        className="relative p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/60 rounded-xl transition-colors"
        aria-label={t(m.alerts.viewNotifications, { count: alerts.length + pendingInvites.length })}
      >
        <AppIcon name="notifications" className=" text-[24px]" />
        {hasUnreadNotifications && (
          <span className="absolute top-1 end-1 w-2.5 h-2.5 bg-error rounded-full animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute end-0 top-12 w-80 bg-surface-container-high border border-outline-variant shadow-xl rounded-2xl p-md z-50 space-y-sm">
          <div className="flex justify-between items-center border-b border-outline-variant pb-2">
            <div className="flex items-center gap-xs">
              <AppIcon name="notifications" className=" text-primary text-[20px]" />
              <h4 className="font-label-lg text-label-lg font-bold text-on-surface">{m.alerts.title}</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-on-surface-variant hover:text-on-surface text-[18px]"
              aria-label={m.common.close}
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pe-1">
            {pendingInvites.length > 0 && <div className="space-y-1 border-b border-outline-variant pb-2"><p className="px-1 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{m.alerts.householdInvitations}</p>{pendingInvites.map((invite) => <Link key={invite.id} href={`/dashboard/profile?invite=${encodeURIComponent(invite.id)}`} onClick={() => setIsOpen(false)} className="block rounded-xl bg-primary/10 p-2.5 text-sm text-on-surface hover:bg-primary/15"><span className="font-bold">{m.alerts.householdInvitation}</span><span className="block text-xs text-on-surface-variant">{t(m.alerts.openToJoinAs, { role: localizeHouseholdRole(invite.role, m) })}</span></Link>)}</div>}
            <p className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{m.alerts.budgetHealth}</p>
            {alerts.length > 0 ? (
              alerts.map((a, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border flex items-start gap-xs ${
                    a.severity === 'error'
                      ? 'bg-error-container/40 border-error/50 text-on-error-container'
                      : 'bg-tertiary-container/40 border-tertiary/50 text-on-tertiary-container'
                  }`}
                >
                  <AppIcon name={a.severity === 'error' ? 'error' : 'warning'} className=" text-[20px] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-label-md text-label-md font-bold">{a.title}</h5>
                    <p className="font-body-sm text-body-sm text-[12px] opacity-90">{a.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="font-body-sm text-body-sm text-on-surface-variant p-2 text-center">
                {m.alerts.allHealthy}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
