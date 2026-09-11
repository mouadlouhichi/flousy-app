'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { MoneyFigure } from '@/components/ui/money-figure';
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
  const { format } = useCurrency();
  const { messages: m } = useLanguage();
  const i = m.insights;
  const nw = calculateNetWorth(month, goals);
  const rows: Array<{ label: string; value: number; icon: string; negative?: boolean }> = [
    { label: i.cash, value: nw.cash, icon: 'account_balance_wallet' },
    { label: i.savings, value: nw.savings, icon: 'savings' },
    { label: i.owedToMe, value: nw.owedToMe, icon: 'call_received' },
    { label: i.iOwe, value: nw.iOwe, icon: 'call_made', negative: true },
  ];

  return (
    <section className="rounded-[1.75rem] border border-outline-variant bg-surface-container-lowest p-5 shadow-ambient">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-on-surface">
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-container-high text-forest dark:text-lime">
            <AppIcon name="account_balance" className="text-[18px]" />
          </span>
          {i.netWorthTitle}
        </h3>
      </div>
      <div className="mt-4">
        <MoneyFigure
          value={Math.abs(nw.net)}
          prefix={nw.net < 0 ? '−' : ''}
          size="xl"
          className={nw.net < 0 ? 'text-error' : 'text-on-surface'}
        />
      </div>
      <ul className="mt-4 divide-y divide-outline-variant/70 rounded-[1.25rem] bg-surface-container-low px-4">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between py-2.5 text-sm">
            <span className="flex items-center gap-2 text-on-surface-variant">
              <AppIcon name={row.icon} className="text-[16px]" />
              {row.label}
            </span>
            <span className={`tabular font-semibold ${row.negative && row.value > 0 ? 'text-error' : 'text-on-surface'}`}>
              {row.negative && row.value > 0 ? '−' : ''}{format(row.value)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
