/**
 * Shared Recharts styling bound to the app's design tokens (src/index.css).
 * Colours are CSS variables resolved at paint time, so dark mode and theme
 * changes need no second palette.
 */
export const CHART_SERIES = [
  'var(--primary)',
  'var(--secondary)',
  'var(--tertiary)',
  '#3b82f6',
  '#8b5cf6',
  '#f97316',
  '#ec4899',
  '#06b6d4',
];

export const chartAxis = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: 'var(--on-surface-variant)', fontWeight: 600 },
} as const;

export const chartGrid = {
  vertical: false,
  stroke: 'var(--outline-variant)',
  strokeOpacity: 0.6,
  strokeDasharray: '3 3',
} as const;

export const chartTooltipClass =
  'rounded-2xl border border-outline-variant bg-surface-container-high px-3 py-2 text-xs shadow-md';
