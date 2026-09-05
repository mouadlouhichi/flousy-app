'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { calculateNetWorth } from '@/lib/insights';
import type { MonthBudget, SavingGoal } from '@/lib/store';

interface NetWorthCardProps {
  month: MonthBudget;
  goals: SavingGoal[];
}

/** Cash + savings + credits − debts. Free for everyone: it is a trust builder. */
export function NetWorthCard({ month, goals }: NetWorthCardProps) {
  const { format, formatParts } = useCurrency();
  const { messages: m } = useLanguage();
  const i = m.insights;
  const nw = calculateNetWorth(month, goals);
  const net = formatParts(Math.abs(nw.net));
  const rows: Array<{ label: string; value: number; icon: string; negative?: boolean }> = [
    { label: i.cash, value: nw.cash, icon: 'account_balance_wallet' },
    { label: i.savings, value: nw.savings, icon: 'savings' },
    { label: i.owedToMe, value: nw.owedToMe, icon: 'call_received' },
    { label: i.iOwe, value: nw.iOwe, icon: 'call_made', negative: true },
  ];

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container p-5 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-base text-on-surface">
          <AppIcon name="account_balance" className="text-[20px] text-primary" />
          {i.netWorthTitle}
        </h3>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`font-mono text-2xl font-extrabold ${nw.net < 0 ? 'text-error' : 'text-on-surface'}`}>
          {nw.net < 0 ? '−' : ''}{net.amount}
        </span>
        <span className="text-xs font-semibold text-on-surface-variant">{net.currency}</span>
      </div>
      <ul className="mt-3 divide-y divide-outline-variant/60">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between py-2 text-sm">
            <span className="flex items-center gap-2 text-on-surface-variant">
              <AppIcon name={row.icon} className="text-[16px]" />
              {row.label}
            </span>
            <span className={`font-mono font-semibold ${row.negative && row.value > 0 ? 'text-error' : 'text-on-surface'}`}>
              {row.negative && row.value > 0 ? '−' : ''}{format(row.value)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
