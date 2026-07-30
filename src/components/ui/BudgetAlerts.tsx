'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState } from 'react';
import { MonthBudget, calculateEnvelopeAmounts, calculateEnvelopeSpent, calculateCategorySpent } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface BudgetAlertsProps {
  month: MonthBudget;
}

export function BudgetAlerts({ month }: BudgetAlertsProps) {
  const { format } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);

  const { needs: needsCap, wants: wantsCap } = calculateEnvelopeAmounts(month.totalBudget, month.strategyId);
  const { needs: needsSpent, wants: wantsSpent } = calculateEnvelopeSpent(month);

  const needsRatio = needsCap > 0 ? (needsSpent / needsCap) * 100 : 0;
  const wantsRatio = wantsCap > 0 ? (wantsSpent / wantsCap) * 100 : 0;

  const alerts: { title: string; message: string; severity: 'warning' | 'error' }[] = [];

  if (needsRatio >= 100) {
    alerts.push({
      title: 'Needs Envelope Exceeded',
      message: `Spent ${format(needsSpent)} vs ${format(needsCap)} budget (${Math.round(needsRatio)}%).`,
      severity: 'error',
    });
  } else if (needsRatio >= 80) {
    alerts.push({
      title: 'Needs Envelope Alert',
      message: `Spent ${format(needsSpent)} of ${format(needsCap)} budget (${Math.round(needsRatio)}%).`,
      severity: 'warning',
    });
  }

  if (wantsRatio >= 100) {
    alerts.push({
      title: 'Wants Envelope Exceeded',
      message: `Spent ${format(wantsSpent)} vs ${format(wantsCap)} budget (${Math.round(wantsRatio)}%).`,
      severity: 'error',
    });
  } else if (wantsRatio >= 80) {
    alerts.push({
      title: 'Wants Envelope Alert',
      message: `Spent ${format(wantsSpent)} of ${format(wantsCap)} budget (${Math.round(wantsRatio)}%).`,
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
        title: `"${cat}" Budget Exceeded`,
        message: `Spent ${format(spent)} vs ${format(budget)} budget (${Math.round(pct)}%).`,
        severity: 'error',
      });
    } else if (pct >= 80) {
      alerts.push({
        title: `"${cat}" Budget Alert`,
        message: `Spent ${format(spent)} of ${format(budget)} budget (${Math.round(pct)}%).`,
        severity: 'warning',
      });
    }
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/60 rounded-xl transition-colors"
        aria-label="View Budget Alerts"
      >
        <AppIcon name="notifications" className=" text-[24px]" />
        {alerts.length > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-error rounded-full animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-surface-container-high border border-outline-variant shadow-xl rounded-2xl p-md z-50 space-y-sm">
          <div className="flex justify-between items-center border-b border-outline-variant pb-2">
            <div className="flex items-center gap-xs">
              <AppIcon name="notifications" className=" text-primary text-[20px]" />
              <h4 className="font-label-lg text-label-lg font-bold text-on-surface">Budget Health</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-on-surface-variant hover:text-on-surface text-[18px]"
            >
              ✕
            </button>
          </div>

          <div className="space-y-xs max-h-60 overflow-y-auto pr-1">
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
                All budget envelopes are healthy! No overspending detected.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
