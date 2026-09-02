'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React from 'react';
import Link from 'next/link';
import { MonthBudget, UserProfile, calculateEnvelopeAmounts, calculateEnvelopeSpent, calculateTotalIncome, fixedPaidAmount, resolveMonthStrategy, totalCashOnHand } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';
import { isProUser } from '../../lib/pro-features';
import { useHousehold } from '../../lib/household-context';
import { AMOUNT_AREA } from '@/lib/household-rbac';
import { canShowProUpgrade, isProFeatureUnlocked } from '../../lib/household';
import { useLanguage } from '@/lib/i18n-context';
import { formatLocalizedPercent } from '@/lib/i18n';
import { localizeCategoryName, localizePersonName, localizeStrategy } from '@/lib/localized-labels';

interface TrendsTabProps {
  month: MonthBudget;
  trendsMonths: { monthKey: string; month: MonthBudget }[];
  trendsLoading: boolean;
  profile: UserProfile | null;
  onOpenProModal: () => void;
}

const CHART_COLORS = [
  '#00685f', '#3b82f6', '#8b5cf6', '#f97316',
  '#ec4899', '#ef4444', '#eab308', '#06b6d4',
  '#6366f1', '#10b981', '#b05e3d', '#84cc16',
  '#d946ef', '#a855f7', '#14b8a6', '#f43f5e',
];

export function TrendsTab({ month, trendsMonths, trendsLoading, profile, onOpenProModal }: TrendsTabProps) {
  const { format } = useCurrency();
  const { messages: m, t, intlLocale, isRTL } = useLanguage();
  const { workspace, canViewArea } = useHousehold();
  // Analytics is a roll-up of the other areas: each card is filtered by the
  // area that owns its numbers, so an analytics grant on its own does not
  // expose balances or income sources to a member who lacks those.
  const canSeeBalances = canViewArea(AMOUNT_AREA.totalCashOnHand);
  const canSeeIncome = canViewArea(AMOUNT_AREA.incomeSource);
  const canSeeExpenses = canViewArea(AMOUNT_AREA.variableExpense);
  const canSeeFixedBills = canViewArea(AMOUNT_AREA.fixedBill);
  const canSeeSavings = canViewArea(AMOUNT_AREA.savingsGoal);
  /** Placeholder shown in place of a figure the member may not see. */
  const redacted = '••••';

  const isPro = isProUser(profile);
  const showUpgrade = canShowProUpgrade(isPro, workspace);
  const proUnlocked = isProFeatureUnlocked(isPro, workspace);
  const hasMultiMonth = trendsMonths.length > 0;

  // ── Current month calculations ──
  const spent = calculateEnvelopeSpent(month);
  const strategy = resolveMonthStrategy(month);
  const strategyCopy = localizeStrategy(strategy.id, m, intlLocale);
  // Same total the Overview shows — custom money places included.
  const totalCash = totalCashOnHand(month);

  // ── Income sources analytics ──
  const incomeSources = month.incomeSources || [];
  const totalIncome = calculateTotalIncome(month);

  // ── Category breakdown ──
  const categoryBreakdown: Record<string, number> = {};
  (month.variableExpenses || []).forEach((exp) => {
    categoryBreakdown[exp.type] = (categoryBreakdown[exp.type] || 0) + exp.amount;
  });
  (month.fixedExpenses || []).forEach((exp) => {
    categoryBreakdown[exp.type] = (categoryBreakdown[exp.type] || 0) + fixedPaidAmount(exp);
  });
  const sortedCategories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);

  // ── Person breakdown ──
  const personBreakdown: Record<string, { variable: number; fixed: number }> = {};
  (month.variableExpenses || []).forEach((exp) => {
    const person = exp.person || 'Self';
    if (!personBreakdown[person]) personBreakdown[person] = { variable: 0, fixed: 0 };
    personBreakdown[person].variable += exp.amount;
  });
  (month.fixedExpenses || []).forEach((exp) => {
    const person = exp.person || 'Self';
    if (!personBreakdown[person]) personBreakdown[person] = { variable: 0, fixed: 0 };
    personBreakdown[person].fixed += fixedPaidAmount(exp);
  });

  // ── Multi-month trend calculations ──
  const monthOverMonth = trendsMonths.map(({ monthKey, month: m }) => {
    const s = calculateEnvelopeSpent(m);
    const env = calculateEnvelopeAmounts(m.totalBudget, m.strategyId, m.customRatios);
    return {
      monthKey,
      label: (() => {
        const [y, num] = monthKey.split('-').map(Number);
        return new Date(y, num - 1, 1).toLocaleDateString(intlLocale, { month: 'short', year: '2-digit' });
      })(),
      totalBudget: m.totalBudget,
      totalSpent: s.totalSpent,
      needsSpent: s.needs,
      wantsSpent: s.wants,
      needsCap: env.needs,
      wantsCap: env.wants,
      savings: env.savings,
      remaining: Math.max(0, m.totalBudget - s.totalSpent),
      totalCash: (m.bankPart || 0) + (m.homePart || 0) + (m.walletPart || 0),
    };
  }).reverse();

  const prevMonth = monthOverMonth.length > 1 ? monthOverMonth[monthOverMonth.length - 2] : null;
  const currentMonthData = monthOverMonth.length > 0 ? monthOverMonth[monthOverMonth.length - 1] : null;
  const spendChange = prevMonth && currentMonthData
    ? prevMonth.totalSpent > 0
      ? ((currentMonthData.totalSpent - prevMonth.totalSpent) / prevMonth.totalSpent) * 100
      : 0
    : 0;

  // Max spent for bar chart scaling
  const maxSpent = Math.max(...monthOverMonth.map((m) => m.totalSpent), 1);

  return (
    <div className="space-y-6 pb-24">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Link
          href="/dashboard/profile"
          prefetch={true}
          aria-label={m.profile.subpages.backToProfile}
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
        >
          <AppIcon name="arrow_back" className={`text-[18px] ${isRTL ? 'rotate-180' : ''}`} />
        </Link>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-on-surface">{m.tabs.trends.title}</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">{m.tabs.trends.description}</p>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {canSeeExpenses && (
        <div className="min-w-0 overflow-hidden p-4 bg-surface-container rounded-2xl border border-outline-variant shadow-2xs">
          <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">{m.tabs.trends.spentThisMonth}</span>
          <p className="mt-1 truncate text-lg font-extrabold font-mono text-on-surface sm:text-[22px]">{format(spent.totalSpent)}</p>
          {prevMonth && (
            <span className={`text-[12px] font-bold ${spendChange > 0 ? 'text-error' : 'text-primary'}`}>
              {spendChange > 0 ? '↑' : '↓'} {t(m.tabs.trends.percentVsLastMonth, { percent: formatLocalizedPercent(Math.abs(spendChange), intlLocale, 1) })}
            </span>
          )}
        </div>
        )}

        {canSeeExpenses && (
        <div className="min-w-0 overflow-hidden p-4 bg-surface-container rounded-2xl border border-outline-variant shadow-2xs">
          <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">{m.tabs.trends.budgetRemaining}</span>
          <p className="mt-1 truncate text-lg font-extrabold font-mono text-primary sm:text-[22px]">
            {format(Math.max(0, month.totalBudget - spent.totalSpent))}
          </p>
          <span className="block truncate text-[12px] font-bold text-on-surface-variant">
            {m.tabs.trends.ofLabel} {format(month.totalBudget)}
          </span>
        </div>
        )}

        {/* Total cash on hand is a `balances` figure: redacted, never hidden
            outright, so the card grid keeps its shape. */}
        <div className="min-w-0 overflow-hidden p-4 bg-surface-container rounded-2xl border border-outline-variant shadow-2xs">
          <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">{m.tabs.trends.totalCash}</span>
          <p className="mt-1 truncate text-lg font-extrabold font-mono text-on-surface sm:text-[22px]">
            {canSeeBalances ? format(totalCash) : redacted}
          </p>
          {canSeeBalances ? (
            <div className="mt-1 flex flex-col gap-0.5 text-[11px] font-bold leading-snug">
              <span className="truncate text-primary">
                {m.places.bank} {format(month.bankPart || 0)}
              </span>
              <span className="truncate text-blue-500">
                {m.places.wallet} {format(month.walletPart || 0)}
              </span>
              <span className="truncate text-amber-600">
                {m.places.home} {format(month.homePart || 0)}
              </span>
            </div>
          ) : (
            <p className="mt-1 text-[11px] font-bold text-on-surface-variant">{m.household.areaRedacted}</p>
          )}
        </div>

        {canSeeSavings && (
        <div className="min-w-0 overflow-hidden p-4 bg-surface-container rounded-2xl border border-outline-variant shadow-2xs">
          <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">{m.tabs.trends.activeGoals}</span>
          <p className="mt-1 truncate text-lg font-extrabold font-mono text-on-surface sm:text-[22px]">
            {format(month.monthlySavingsTarget || 0)}
          </p>
          <span className="block break-words text-[12px] font-bold leading-snug text-on-surface-variant">
            {t(m.tabs.trends.strategySavings, {
              strategy: strategyCopy.name,
              percent: formatLocalizedPercent(Math.round(strategy.savingsRatio * 100), intlLocale),
            })}
          </span>
        </div>
        )}
      </div>

      {/* ── Multi-Month Trends (Pro feature) ──
          Budget / spent / remaining per month are `expenses` figures. */}
      {canSeeExpenses && (
      <div className="p-5 sm:p-6 bg-surface-container rounded-3xl border border-outline-variant">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AppIcon name="bar_chart" className=" text-primary text-[24px]" />
            <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">{m.tabs.trends.monthOverMonth}</h3>
          </div>
          {showUpgrade && (
            <button
              onClick={onOpenProModal}
              className="text-[12px] font-extrabold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
            >
              {m.tabs.trends.proLabel}
            </button>
          )}
        </div>

        {trendsLoading ? (
          <div className="h-48 bg-surface-variant/30 rounded-2xl animate-pulse flex items-center justify-center">
            <span className="text-on-surface-variant font-medium">{m.tabs.trends.loadingTrends}</span>
          </div>
        ) : monthOverMonth.length > 1 && proUnlocked ? (
          /* Bar chart with month-over-month comparison */
          <div className="space-y-4">
            <div className="flex items-end gap-2 sm:gap-3 h-48">
              {monthOverMonth.map((m, idx) => {
                const heightPct = Math.max(8, (m.totalSpent / maxSpent) * 100);
                const isCurrent = idx === monthOverMonth.length - 1;
                return (
                  <div key={m.monthKey} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="w-full truncate text-center text-[10px] font-bold font-mono text-on-surface-variant">{format(m.totalSpent)}</span>
                    <div
                      className={`w-full rounded-lg transition-all duration-300 ${
                        isCurrent ? 'bg-primary' : 'bg-primary/40'
                      }`}
                      style={{ height: `${heightPct}%`, minHeight: '16px' }}
                    />
                    <span className={`text-[10px] font-bold ${isCurrent ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Trend summary table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-on-surface-variant font-extrabold uppercase tracking-wider border-b border-outline-variant">
                    <th className="text-start py-2 pe-3">{m.tabs.trends.month}</th>
                    <th className="text-end py-2 px-3">{m.tabs.trends.budget}</th>
                    <th className="text-end py-2 px-3">{m.tabs.trends.spent}</th>
                    <th className="text-end py-2 px-3">{m.tabs.trends.remaining}</th>
                    <th className="text-end py-2 ps-3">{m.tabs.trends.savingsPercent}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthOverMonth.map((m) => (
                    <tr key={m.monthKey} className="border-b border-outline-variant/30">
                      <td className="py-2 pe-3 font-bold text-on-surface">{m.label}</td>
                      <td className="py-2 px-3 text-end font-mono text-on-surface">{format(m.totalBudget)}</td>
                      <td className="py-2 px-3 text-end font-mono text-on-surface">{format(m.totalSpent)}</td>
                      <td className="py-2 px-3 text-end font-mono text-primary">{format(m.remaining)}</td>
                      <td className="py-2 ps-3 text-end font-mono text-on-surface">
                        {m.totalBudget > 0
                          ? new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }).format(m.savings / m.totalBudget)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-8 bg-surface-container rounded-2xl border border-dashed border-outline-variant flex flex-col items-center text-center gap-2">
            <AppIcon name="bar_chart" className=" text-outline text-[36px]" />
            <p className="font-body-md text-body-md text-on-surface-variant">{m.tabs.trends.notEnoughData}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{m.tabs.trends.addExpensesForTrends}</p>
          </div>
        )}
      </div>

      )}

      {/* ── Income Sources Breakdown ──
          Income is its own RBAC area. Without the grant the whole section is
          dropped — not blurred, not zeroed — because even the source *names*
          and the combined total are household financial data. */}
      {canSeeIncome && (
      <div className="p-5 sm:p-6 bg-surface-container rounded-3xl border border-outline-variant">
        <div className="flex items-center gap-2 mb-4">
          <AppIcon name="payments" className=" text-primary text-[24px]" />
          <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">{m.tabs.trends.incomeSources}</h3>
        </div>

        {proUnlocked && incomeSources.length > 0 ? (
          <div className="space-y-3">
            {incomeSources.map((src, idx) => {
              const pct = totalIncome > 0 ? Math.round(((src.amount || 0) / totalIncome) * 100) : 0;
              return (
                <div key={src.id} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="font-label-lg text-label-lg font-bold text-on-surface">{src.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-on-surface-variant">
                        {new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }).format(pct / 100)}
                      </span>
                      <span className="font-label-lg text-label-lg font-extrabold text-on-surface font-mono">{format(src.amount || 0)}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-outline-variant rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="flex justify-between items-center pt-2 border-t border-outline-variant">
              <span className="font-bold text-on-surface text-[15px]">{m.tabs.trends.totalCombinedIncome}</span>
              <span className="font-extrabold text-primary font-mono text-[18px]">{format(totalIncome)}</span>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-surface-container rounded-2xl border border-dashed border-outline-variant text-center">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {proUnlocked ? m.tabs.trends.noIncomeSources : m.tabs.trends.incomeSourcesPro}
            </p>
          </div>
        )}
      </div>
      )}

      {/* ── Category Trend Breakdown ── */}
      {canSeeExpenses && (
      <div className="p-5 sm:p-6 bg-surface-container rounded-3xl border border-outline-variant">
        <div className="flex items-center gap-2 mb-4">
          <AppIcon name="category" className=" text-primary text-[24px]" />
          <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">{m.tabs.trends.categoryBreakdown}</h3>
        </div>

        {sortedCategories.length > 0 ? (
          <div className="flex flex-col gap-3">
            {sortedCategories.map(([cat, amount], idx) => {
              const pct = spent.totalSpent > 0 ? Math.round((amount / spent.totalSpent) * 100) : 0;
              return (
                <div key={cat} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="font-label-lg text-label-lg font-bold text-on-surface">{localizeCategoryName(cat, m)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-on-surface-variant">
                        {new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }).format(pct / 100)}
                      </span>
                      <span className="font-label-lg text-label-lg font-extrabold text-on-surface font-mono">{format(amount)}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-outline-variant rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="flex justify-between items-center pt-2 border-t border-outline-variant">
              <span className="font-bold text-on-surface text-[15px]">{m.tabs.trends.totalSpent}</span>
              <span className="font-extrabold text-on-surface font-mono text-[18px]">{format(spent.totalSpent)}</span>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-surface-container rounded-2xl border border-dashed border-outline-variant text-center">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {m.tabs.trends.noExpenses}
            </p>
          </div>
        )}
      </div>
      )}

      {/* ── Household Spending Breakdown ── */}
      {proUnlocked && canSeeExpenses && canSeeFixedBills && Object.keys(personBreakdown).length > 0 && (
        <div className="p-5 sm:p-6 bg-surface-container rounded-3xl border border-outline-variant">
          <div className="flex items-center gap-2 mb-4">
            <AppIcon name="family_restroom" className=" text-primary text-[24px]" />
            <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">{m.tabs.trends.householdSpending}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(personBreakdown).map(([person, data], idx) => {
              const total = data.variable + data.fixed;
              const totalAll = Object.values(personBreakdown).reduce((a, b) => a + b.variable + b.fixed, 0);
              const pct = totalAll > 0 ? Math.round((total / totalAll) * 100) : 0;
              return (
                <div key={person} className="min-w-0 overflow-hidden p-4 bg-surface-container rounded-2xl border border-outline-variant flex flex-col gap-2 shadow-2xs">
                  <div className="flex justify-between items-center gap-2 min-w-0">
                    <span className="min-w-0 truncate font-label-lg text-label-lg font-bold text-on-surface">{localizePersonName(person, m)}</span>
                    <span className="text-[12px] font-bold text-primary">
                      {new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }).format(pct / 100)}
                    </span>
                  </div>
                  <span className="truncate text-[20px] font-extrabold font-mono text-on-surface">{format(total)}</span>
                  <div className="w-full h-2 bg-outline-variant rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-on-surface-variant">
                    <span>{t(m.tabs.trends.variableAmount, { amount: format(data.variable) })}</span>
                    <span>{t(m.tabs.trends.fixedAmount, { amount: format(data.fixed) })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showUpgrade && (
        <div className="p-5 sm:p-6 bg-surface-container rounded-3xl border border-outline-variant">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {m.tabs.trends.advancedAnalytics}
          </p>
        </div>
      )}

      {/* ── Budget Health Summary ── */}
      {canSeeExpenses && (
      <div className="p-5 sm:p-6 bg-surface-container rounded-3xl border border-outline-variant">
        <div className="flex items-center gap-2 mb-4">
          <AppIcon name="health_and_safety" className=" text-primary text-[24px]" />
          <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">{m.tabs.trends.budgetHealth}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Needs */}
          <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant flex flex-col gap-2 shadow-2xs">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="font-bold text-on-surface">{t(m.tabs.trends.needsLabel, { percent: formatLocalizedPercent(Math.round(strategy.needsRatio * 100), intlLocale) })}</span>
              </div>
              <span className="font-bold text-[14px] font-mono text-on-surface">{format(spent.needs)} / {format(spent.needs + spent.wants + spent.savings > 0 ? (spent.needs / (spent.needs + spent.wants + spent.savings)) * 100 : 0).replace(/[0-9.,]/g, '').trim() || format(month.totalBudget)}</span>
            </div>
            {(() => {
              const env = calculateEnvelopeAmounts(month.totalBudget, month.strategyId, month.customRatios);
              const pct = env.needs > 0 ? Math.min(100, Math.round((spent.needs / env.needs) * 100)) : 0;
              return (
                <div className="w-full h-2.5 bg-primary/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-tertiary' : 'bg-primary'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              );
            })()}
          </div>

          {/* Wants */}
          <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant flex flex-col gap-2 shadow-2xs">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary" />
                <span className="font-bold text-on-surface">{t(m.tabs.trends.wantsLabel, { percent: formatLocalizedPercent(Math.round(strategy.wantsRatio * 100), intlLocale) })}</span>
              </div>
              <span className="font-bold text-[14px] font-mono text-on-surface">{format(spent.wants)}</span>
            </div>
            {(() => {
              const env = calculateEnvelopeAmounts(month.totalBudget, month.strategyId, month.customRatios);
              const pct = env.wants > 0 ? Math.min(100, Math.round((spent.wants / env.wants) * 100)) : 0;
              return (
                <div className="w-full h-2.5 bg-primary/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-tertiary' : 'bg-amber-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
