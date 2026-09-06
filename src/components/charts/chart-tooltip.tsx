'use client';

import { chartTooltipClass } from './chart-theme';

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string | number }>;
  format: (value: number) => string;
  /** Optional per-series label override (dataKey → label). */
  names?: Record<string, string>;
}

/** Design-system tooltip for every Recharts chart in the app. */
export function ChartTooltip({ active, label, payload, format, names }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className={chartTooltipClass} dir="auto">
      {label !== undefined && <p className="mb-1 font-bold text-on-surface">{label}</p>}
      <ul className="flex flex-col gap-0.5">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-on-surface-variant">
              <span className="inline-block size-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {names?.[String(entry.dataKey)] ?? entry.name ?? String(entry.dataKey)}
            </span>
            <span className="font-mono font-bold text-on-surface">
              {typeof entry.value === 'number' ? format(entry.value) : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
