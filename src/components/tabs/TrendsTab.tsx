'use client';

import React from 'react';
import { MonthBudget, UserProfile, calculateEnvelopeSpent } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface TrendsTabProps {
  month: MonthBudget;
  profile: UserProfile | null;
  onOpenProModal: () => void;
}

export function TrendsTab({ month }: TrendsTabProps) {
  const { format } = useCurrency();

  // Person breakdown calculations
  const personBreakdown: Record<string, { variable: number; fixed: number }> = {};
  (month.variableExpenses || []).forEach((exp) => {
    const person = exp.person || 'Self';
    if (!personBreakdown[person]) personBreakdown[person] = { variable: 0, fixed: 0 };
    personBreakdown[person].variable += exp.amount;
  });
  (month.fixedExpenses || []).forEach((exp) => {
    const person = exp.person || 'Self';
    if (!personBreakdown[person]) personBreakdown[person] = { variable: 0, fixed: 0 };
    personBreakdown[person].fixed += exp.amount;
  });

  const totalHouseholdSpent = Object.values(personBreakdown).reduce(
    (a, b) => a + b.variable + b.fixed,
    0
  );

  // Category breakdown for debts context
  const categoryBreakdown: Record<string, number> = {};
  (month.variableExpenses || []).forEach((exp) => {
    categoryBreakdown[exp.type] = (categoryBreakdown[exp.type] || 0) + exp.amount;
  });
  (month.fixedExpenses || []).forEach((exp) => {
    categoryBreakdown[exp.type] = (categoryBreakdown[exp.type] || 0) + exp.amount;
  });

  const sortedCategories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);
  const totalAllSpent = calculateEnvelopeSpent(month).totalSpent;

  const DEBT_COLORS = [
    '#00685f', '#3b82f6', '#8b5cf6', '#f97316',
    '#ec4899', '#ef4444', '#eab308', '#06b6d4',
    '#6366f1', '#10b981', '#b05e3d', '#84cc16',
  ];

  return (
    <div className="space-y-md pb-xl">
      {/* Header card */}
      <div className="p-md sm:p-lg bg-surface-container rounded-3xl border border-outline-variant flex flex-col gap-xs">
        <div className="flex items-center gap-xs">
          <span className="material-symbols-outlined text-primary text-[24px]">handshake</span>
          <h2 className="font-headline-sm sm:font-headline-md text-headline-sm sm:font-headline-md font-extrabold text-on-surface">
            Debts & Spending Breakdown
          </h2>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Track spending per household member and see who owes what for the current month.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-sm">
        <div className="p-md bg-surface-container rounded-2xl border border-outline-variant">
          <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase">Total Spent</span>
          <p className="font-headline-sm sm:font-headline-md font-extrabold text-on-surface mt-1">{format(totalAllSpent)}</p>
        </div>
        <div className="p-md bg-surface-container rounded-2xl border border-outline-variant">
          <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase">Members</span>
          <p className="font-headline-sm sm:font-headline-md font-extrabold text-on-surface mt-1">{Object.keys(personBreakdown).length || '—'}</p>
        </div>
        <div className="p-md bg-surface-container rounded-2xl border border-outline-variant col-span-2 sm:col-span-1">
          <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase">Budget Left</span>
          <p className="font-headline-sm sm:font-headline-md font-extrabold text-primary mt-1">
            {format(Math.max(0, month.totalBudget - totalAllSpent))}
          </p>
        </div>
      </div>

      {/* Household / Person Spending Breakdown */}
      <div className="p-md sm:p-lg bg-surface-container rounded-3xl border border-outline-variant space-y-md">
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
            Object.entries(personBreakdown).map(([person, data], idx) => {
              const total = data.variable + data.fixed;
              const pct = totalHouseholdSpent > 0 ? Math.round((total / totalHouseholdSpent) * 100) : 0;
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
                      {format(total)}
                    </span>
                    <div className="w-full h-2 bg-surface-variant rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: DEBT_COLORS[idx % DEBT_COLORS.length],
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-[11px] font-bold text-on-surface-variant">
                      <span>Variable: {format(data.variable)}</span>
                      <span>Fixed: {format(data.fixed)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant col-span-full text-center py-md">
              No transactions yet. Add expenses to see the household breakdown.
            </p>
          )}
        </div>
      </div>

      {/* Category Spending Breakdown */}
      <div className="p-md sm:p-lg bg-surface-container rounded-3xl border border-outline-variant space-y-md">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-title-md text-title-md font-bold text-on-surface">Spending by Category</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              See where your money goes this month.
            </p>
          </div>
          <span className="material-symbols-outlined text-primary text-[28px]">category</span>
        </div>

        {sortedCategories.length > 0 ? (
          <div className="flex flex-col gap-sm">
            {sortedCategories.map(([cat, amount], idx) => {
              const pct = totalAllSpent > 0 ? Math.round((amount / totalAllSpent) * 100) : 0;
              return (
                <div key={cat} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: DEBT_COLORS[idx % DEBT_COLORS.length] }}
                      />
                      <span className="font-label-lg text-label-lg font-bold text-on-surface">{cat}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">{pct}%</span>
                      <span className="font-label-lg text-label-lg font-extrabold text-on-surface">{format(amount)}</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: DEBT_COLORS[idx % DEBT_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center py-md">
            No expenses recorded yet for this month.
          </p>
        )}
      </div>
    </div>
  );
}
