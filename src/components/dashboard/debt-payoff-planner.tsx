'use client';

import { useMemo, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { planDebtPayoff, type PayoffMethod } from '@/lib/insights';
import type { MonthBudget } from '@/lib/store';
import { ProLockedCard } from './pro-locked-card';
import { DebtPayoffChart } from '../charts/debt-payoff-chart';

interface DebtPayoffPlannerProps {
  month: MonthBudget;
  unlocked: boolean;
  onUpgrade: () => void;
}

export function DebtPayoffPlanner({ month, unlocked, onUpgrade }: DebtPayoffPlannerProps) {
  const { profile, updateProfileData } = useAuth();
  const { format } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const p = m.planner;
  const [draftBudget, setDraftBudget] = useState<string>(profile?.debtPayoffBudget ? String(profile.debtPayoffBudget) : '');
  const method: PayoffMethod = profile?.debtPayoffMethod || 'snowball';
  const budget = Number(draftBudget.replace(',', '.')) || 0;

  const plan = useMemo(() => planDebtPayoff(month.debts || [], budget, method), [month.debts, budget, method]);
  const openDebts = (month.debts || []).filter((d) => d.type === 'debt' && d.status === 'open');

  const monthLabel = (iso: string) => {
    const [y, mo] = iso.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(intlLocale, { month: 'long', year: 'numeric' });
  };
  const shortMonth = (iso: string) => {
    const [y, mo] = iso.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(intlLocale, { month: 'short', year: '2-digit' });
  };
  const compactAxis = (value: number) =>
    new Intl.NumberFormat(intlLocale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const debtNames = Object.fromEntries((month.debts || []).map((d) => [d.id, d.name]));

  const persist = (patch: { debtPayoffBudget?: number; debtPayoffMethod?: PayoffMethod }) => {
    if (!profile) return;
    void updateProfileData(patch).catch(() => {});
  };

  if (!unlocked) {
    return (
      <ProLockedCard
        icon="flag"
        title={p.title}
        body={m.profile.pro.features.debtPlanner.description}
        onUpgrade={onUpgrade}
      />
    );
  }

  if (openDebts.length === 0) return null;

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container p-5 shadow-2xs">
      <h3 className="flex items-center gap-2 font-bold text-on-surface">
        <AppIcon name="flag" className="text-[20px] text-primary" />
        {p.title}
      </h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          {p.monthlyBudget}
          <input
            type="text"
            inputMode="decimal"
            value={draftBudget}
            onChange={(e) => setDraftBudget(e.target.value)}
            onBlur={() => persist({ debtPayoffBudget: budget })}
            placeholder="0"
            className="rounded-2xl border border-outline-variant bg-surface px-4 py-2.5 font-mono text-base font-bold normal-case tracking-normal text-on-surface outline-none focus:border-primary"
          />
        </label>
        <div className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          {p.method}
          <div className="flex gap-1.5">
            {(['snowball', 'avalanche'] as PayoffMethod[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => persist({ debtPayoffMethod: option })}
                className={`flex-1 rounded-2xl px-3 py-2.5 text-xs font-bold normal-case tracking-normal transition-colors ${
                  method === option ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {p[option]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {plan.monthsToDebtFree && plan.debtFreeOn ? (
        <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-lg font-extrabold text-primary">{t(p.debtFreeOn, { date: monthLabel(plan.debtFreeOn) })}</p>
          <p className="text-xs font-semibold text-on-surface-variant">
            {t(p.debtFreeIn, { count: plan.monthsToDebtFree })} · {format(plan.totalOutstanding)}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-on-surface-variant">{p.noBudget}</p>
      )}

      {plan.steps.length > 0 && (
        <div className="mt-4">
          <DebtPayoffChart plan={plan} debtNames={debtNames} format={format} compactAxis={compactAxis} monthLabel={shortMonth} />
        </div>
      )}

      {plan.steps.length > 0 && (
        <ol className="mt-4 flex flex-col gap-2">
          {plan.steps.map((step, index) => (
            <li key={step.debtId} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-high px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 text-on-surface">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">{index + 1}</span>
                <span className="font-semibold">{step.name}</span>
              </span>
              <span className="text-end">
                <span className="block font-mono font-bold text-on-surface">{format(step.outstanding)}</span>
                <span className="block text-[11px] text-on-surface-variant">{t(p.paidOffOn, { date: monthLabel(step.paidOffOn) })}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
