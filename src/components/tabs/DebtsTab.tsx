'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState } from 'react';
import { MonthBudget } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { localizeDebtStatus } from '@/lib/localized-labels';
import { formatShortDate } from '@/lib/utils';

interface DebtsTabProps {
  month: MonthBudget;
  onOpenDebtModal: () => void;
}

type TabKey = 'debts' | 'credits';

export function DebtsTab({ month, onOpenDebtModal }: DebtsTabProps) {
  const { format, formatParts } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabKey>('debts');

  const debts = month.debts || [];
  const filtered = debts.filter((d) => d.type === (activeTab === 'debts' ? 'debt' : 'credit'));

  const openCount = filtered.filter((d) => d.status === 'open').length;
  const settledCount = filtered.filter((d) => d.status === 'settled').length;
  const totalAmount = filtered.reduce((acc, d) => acc + d.amount, 0);
  const totalParts = formatParts(totalAmount);

  const label = activeTab === 'debts' ? m.tabs.debts.totalYouOwe : m.tabs.debts.totalOwedToYou;
  const emptyTitle = activeTab === 'debts' ? m.tabs.debts.noDebtsTitle : m.tabs.debts.noCreditsTitle;
  const emptyDesc = activeTab === 'debts' ? m.tabs.debts.noDebtsDesc : m.tabs.debts.noCreditsDesc;

  return (
    <div className="space-y-6 pb-24">
      {/* Tab Toggle */}
      <div className="flex bg-surface-variant/40 rounded-2xl p-1">
        <button
          type="button"
          onClick={() => setActiveTab('debts')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'debts'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          {m.tabs.debts.debtsIOwe}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('credits')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'credits'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          {m.tabs.debts.creditsOwedToMe}
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-surface-container rounded-3xl border border-outline-variant/80 shadow-2xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            {label}
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-[44px] font-extrabold text-on-surface leading-none">
              {totalParts.amount}
            </span>
            <span className="text-[20px] font-extrabold text-on-surface-variant/60 leading-none">
              {totalParts.currency}
            </span>
          </div>
          <span className="text-[13px] text-on-surface-variant mt-1.5 block">
            {t(m.tabs.debts.openSettled, { open: new Intl.NumberFormat(intlLocale).format(openCount), settled: new Intl.NumberFormat(intlLocale).format(settledCount) })}
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenDebtModal}
          className="w-full sm:w-auto sm:self-start px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm flex items-center justify-center sm:justify-start gap-1.5 hover:bg-accent-foreground transition-all shadow-sm"
        >
          <AppIcon name="add" className=" text-[18px]" />
          {m.common.add}
        </button>
      </div>

      {/* Debts List or Empty State */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="bg-surface-container rounded-2xl border border-outline-variant/80 p-4 flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    d.status === 'settled'
                      ? 'bg-surface-container text-on-surface-variant/60'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  <AppIcon name={d.status === 'settled' ? 'check_circle' : 'account_balance'} className=" text-[20px]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-on-surface text-[15px] truncate">{d.name}</span>
                  <span className="text-[12px] text-on-surface-variant">{formatShortDate(d.date, intlLocale)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`font-extrabold font-mono text-[16px] ${
                    d.status === 'settled' ? 'text-on-surface-variant/60 line-through' : 'text-on-surface'
                  }`}
                >
                  {format(d.amount)}
                </span>
                <span
                  className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    d.status === 'settled'
                      ? 'bg-surface-container text-on-surface-variant'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {localizeDebtStatus(d.status, m)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <AppIcon name="account_balance" className="text-[40px] text-primary" />
          </div>
          <h3 className="text-[22px] font-extrabold text-on-surface">{emptyTitle}</h3>
          <p className="text-[15px] text-on-surface-variant mt-2 max-w-xs leading-relaxed">
            {emptyDesc}
          </p>
          <button
            type="button"
            onClick={onOpenDebtModal}
            className="mt-6 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-accent-foreground transition-all shadow-sm"
          >
            <AppIcon name="add" className="text-[18px]" />
            {activeTab === 'debts' ? m.modals.debt.addTitle : m.modals.debt.addCredit}
          </button>
        </div>
      )}
    </div>
  );
}
