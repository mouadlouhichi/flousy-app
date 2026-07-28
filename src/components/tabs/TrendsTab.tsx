'use client';

import React from 'react';
import { MonthBudget, UserProfile, calculateEnvelopeAmounts, calculateEnvelopeSpent } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '../../lib/i18n-context';

interface TrendsTabProps {
  month: MonthBudget;
  profile: UserProfile | null;
  onOpenProModal: () => void;
}

export function TrendsTab({ month, profile, onOpenProModal }: TrendsTabProps) {
  const { format } = useCurrency();
  const { t } = useLanguage();

  const isPro = profile?.plan === 'pro';

  // Sample data points for multi-month trends chart
  const historicalData = [
    { month: 'Apr', income: month.totalBudget * 0.95, spent: month.totalBudget * 0.72, savings: month.totalBudget * 0.23 },
    { month: 'May', income: month.totalBudget * 0.98, spent: month.totalBudget * 0.68, savings: month.totalBudget * 0.30 },
    { month: 'Jun', income: month.totalBudget, spent: month.totalBudget * 0.75, savings: month.totalBudget * 0.25 },
    { month: 'Jul', income: month.totalBudget, spent: calculateEnvelopeSpent(month).totalSpent, savings: calculateEnvelopeSpent(month).savings },
  ];

  const maxVal = Math.max(...historicalData.map((d) => Math.max(d.income, d.spent)));

  // Person breakdown calculations
  const personBreakdown: Record<string, number> = {};
  (month.variableExpenses || []).forEach((exp) => {
    const person = exp.person || 'Self';
    personBreakdown[person] = (personBreakdown[person] || 0) + exp.amount;
  });
  (month.fixedExpenses || []).forEach((exp) => {
    const person = exp.person || 'Self';
    personBreakdown[person] = (personBreakdown[person] || 0) + exp.amount;
  });

  const totalHouseholdSpent = Object.values(personBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-md pb-xl">
      {/* Header card */}
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
        <div>
          <div className="flex items-center gap-xs">
            <h2 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">
              Multi-Month Trends & Analytics
            </h2>
            {!isPro && (
              <span className="px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-label-sm text-[11px] font-bold">
                PRO FEATURE
              </span>
            )}
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Track income stability, expense velocity, and household spending patterns over time.
          </p>
        </div>

        {!isPro && (
          <button
            type="button"
            onClick={onOpenProModal}
            className="py-2.5 px-md bg-gradient-to-r from-primary to-tertiary text-on-primary rounded-xl font-label-md text-label-md font-bold shadow-md hover:opacity-90 transition-all flex items-center gap-xs whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[20px]">workspace_premium</span>
            <span>Unlock Historical Trends</span>
          </button>
        )}
      </div>

      {/* Main Income vs Expense Multi-Month Chart */}
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant space-y-md relative">
        {!isPro && (
          <div className="absolute inset-0 bg-surface/60 backdrop-blur-[2px] z-10 rounded-3xl flex flex-col items-center justify-center p-md text-center">
            <span className="material-symbols-outlined text-[40px] text-primary mb-2">lock</span>
            <h3 className="font-title-md text-title-md font-extrabold text-on-surface">Pro Analytics Preview</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm mb-md">
              Upgrade to Pro to visualize historical month-over-month performance and spending trends.
            </p>
            <button
              type="button"
              onClick={onOpenProModal}
              className="py-2 px-md bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold shadow-sm hover:opacity-90 transition-all"
            >
              Upgrade to Unlock
            </button>
          </div>
        )}

        <div className="flex justify-between items-center">
          <h3 className="font-title-md text-title-md font-bold text-on-surface">
            Income vs Spending History
          </h3>
          <div className="flex items-center gap-md text-label-sm">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <span>Income</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-error" />
              <span>Spent</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Graph */}
        <div className="h-64 flex items-end justify-between gap-md pt-md px-xs border-b border-outline-variant">
          {historicalData.map((d, idx) => {
            const incomeHeight = maxVal > 0 ? (d.income / maxVal) * 100 : 0;
            const spentHeight = maxVal > 0 ? (d.spent / maxVal) * 100 : 0;

            return (
              <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end gap-xs">
                <div className="w-full flex justify-center items-end gap-1.5 h-full">
                  {/* Income bar */}
                  <div
                    style={{ height: `${incomeHeight}%` }}
                    className="w-1/2 max-w-[32px] bg-primary/80 hover:bg-primary rounded-t-lg transition-all relative group"
                  >
                    <span className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface text-[10px] px-1.5 py-0.5 rounded shadow-md whitespace-nowrap pointer-events-none transition-opacity font-bold">
                      {format(d.income)}
                    </span>
                  </div>

                  {/* Spent bar */}
                  <div
                    style={{ height: `${spentHeight}%` }}
                    className="w-1/2 max-w-[32px] bg-error/80 hover:bg-error rounded-t-lg transition-all relative group"
                  >
                    <span className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface text-[10px] px-1.5 py-0.5 rounded shadow-md whitespace-nowrap pointer-events-none transition-opacity font-bold">
                      {format(d.spent)}
                    </span>
                  </div>
                </div>
                <span className="font-label-md text-label-md font-bold text-on-surface-variant">
                  {d.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Household / Person Spending Breakdown */}
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant space-y-md">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-title-md text-title-md font-bold text-on-surface">Household Member Spending</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Spending distributed by person for the current month.
            </p>
          </div>
          <span className="material-symbols-outlined text-primary text-[28px]">family_restroom</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-md">
          {Object.entries(personBreakdown).length > 0 ? (
            Object.entries(personBreakdown).map(([person, amount]) => {
              const pct = totalHouseholdSpent > 0 ? Math.round((amount / totalHouseholdSpent) * 100) : 0;
              return (
                <div
                  key={person}
                  className="p-md bg-surface-container-low rounded-2xl border border-outline-variant flex flex-col justify-between"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-label-lg text-label-lg font-bold text-on-surface">{person}</span>
                    <span className="font-label-sm text-label-sm text-primary font-bold">{pct}%</span>
                  </div>
                  <div className="mt-sm">
                    <span className="font-headline-sm text-headline-sm font-extrabold text-on-surface">
                      {format(amount)}
                    </span>
                    <div className="w-full h-2 bg-surface-variant rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant col-span-full">
              No transactions with designated household members yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
