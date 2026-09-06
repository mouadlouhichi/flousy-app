'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLanguage } from '@/lib/i18n-context';
import type { PayoffPlan } from '@/lib/insights';
import { CHART_SERIES, chartAxis, chartGrid } from './chart-theme';
import { ChartTooltip } from './chart-tooltip';

interface DebtPayoffChartProps {
  plan: PayoffPlan;
  debtNames: Record<string, string>;
  format: (value: number) => string;
  compactAxis: (value: number) => string;
  monthLabel: (iso: string) => string;
}

/** Stacked balances over time — each band is one debt shrinking to zero. */
export function DebtPayoffChart({ plan, debtNames, format, compactAxis, monthLabel }: DebtPayoffChartProps) {
  const { isRTL } = useLanguage();
  if (plan.timeline.length < 2) return null;
  const ids = Object.keys(plan.timeline[0].balances);
  const data = plan.timeline.map((point) => ({ month: monthLabel(point.month), ...point.balances }));
  // Show ~6 evenly spaced x labels regardless of plan length.
  const interval = Math.max(0, Math.ceil(data.length / 6) - 1);

  return (
    <div className="h-48 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            {ids.map((id, idx) => (
              <linearGradient key={id} id={`debt-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_SERIES[idx % CHART_SERIES.length]} stopOpacity={0.55} />
                <stop offset="100%" stopColor={CHART_SERIES[idx % CHART_SERIES.length]} stopOpacity={0.08} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...chartGrid} />
          <XAxis dataKey="month" {...chartAxis} interval={interval} reversed={isRTL} />
          <YAxis {...chartAxis} width={48} tickFormatter={compactAxis} orientation={isRTL ? 'right' : 'left'} />
          <Tooltip content={<ChartTooltip format={format} names={debtNames} />} />
          {ids.map((id, idx) => (
            <Area
              key={id}
              type="monotone"
              dataKey={id}
              name={debtNames[id] || id}
              stackId="debts"
              stroke={CHART_SERIES[idx % CHART_SERIES.length]}
              strokeWidth={1.5}
              fill={`url(#debt-${id})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
