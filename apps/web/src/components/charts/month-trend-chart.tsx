'use client';

import {
  Bar,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLanguage } from '@/lib/i18n-context';
import { chartAxis, chartGrid } from './chart-theme';
import { ChartTooltip } from './chart-tooltip';

export interface MonthTrendPoint {
  monthKey: string;
  label: string;
  totalSpent: number;
  totalBudget: number;
  netSaved: number;
}

interface MonthTrendChartProps {
  data: MonthTrendPoint[];
  format: (value: number) => string;
  labels: { spent: string; budget: string; netSaved: string };
  compactAxis: (value: number) => string;
}

/**
 * Month-over-month spending: bars = spent (current month emphasised), line =
 * budget cap, so an over-budget month is visible at a glance. Replaces the
 * hand-rolled div bars; the data table underneath stays the accessible view.
 */
export function MonthTrendChart({ data, format, labels, compactAxis }: MonthTrendChartProps) {
  const { isRTL } = useLanguage();
  const last = data.length - 1;
  return (
    <div className="h-56 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid {...chartGrid} />
          <XAxis dataKey="label" {...chartAxis} reversed={isRTL} interval={0} />
          <YAxis {...chartAxis} width={48} tickFormatter={compactAxis} orientation={isRTL ? 'right' : 'left'} />
          <Tooltip
            cursor={{ fill: 'var(--outline-variant)', fillOpacity: 0.25 }}
            content={<ChartTooltip format={format} names={{ totalSpent: labels.spent, totalBudget: labels.budget }} />}
          />
          <Bar dataKey="totalSpent" name={labels.spent} radius={[8, 8, 4, 4]} maxBarSize={44}>
            {data.map((entry, idx) => (
              <Cell
                key={entry.monthKey}
                fill={entry.totalSpent > entry.totalBudget && entry.totalBudget > 0
                  ? 'var(--error)'
                  : 'var(--primary)'}
                fillOpacity={idx === last ? 1 : 0.45}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="totalBudget"
            name={labels.budget}
            stroke="var(--tertiary)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
