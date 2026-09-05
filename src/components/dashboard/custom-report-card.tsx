'use client';

import { useMemo, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { useHousehold } from '@/lib/household-context';
import {
  buildCustomReport,
  reportDimensionValues,
  type ReportDimension,
  type ReportScope,
} from '@/lib/insights';
import type { MonthBudget } from '@/lib/store';
import { localizeCategoryName, localizePersonName, localizePlaceName } from '@/lib/localized-labels';
import { ProLockedCard } from './pro-locked-card';

interface CustomReportCardProps {
  /** Months newest first (current month included). */
  months: Array<{ monthKey: string; month: MonthBudget }>;
  unlocked: boolean;
  onUpgrade: () => void;
  canSeeFixedBills: boolean;
}

const RANGES = [1, 3, 6, 12] as const;

export function CustomReportCard({ months, unlocked, onUpgrade, canSeeFixedBills }: CustomReportCardProps) {
  const { messages: m, t, intlLocale } = useLanguage();
  const { format } = useCurrency();
  const { workspace, members } = useHousehold();
  const r = m.reports;

  const [dimension, setDimension] = useState<ReportDimension>('place');
  const [scope, setScope] = useState<ReportScope>(canSeeFixedBills ? 'all' : 'variable');
  const [range, setRange] = useState<(typeof RANGES)[number]>(3);
  const [filterDim, setFilterDim] = useState<ReportDimension | ''>('');
  const [filterValue, setFilterValue] = useState('');

  const window = useMemo(() => months.slice(0, range).map((e) => e.month), [months, range]);
  const previous = useMemo(() => months.slice(range, range * 2).map((e) => e.month), [months, range]);

  const label = (dim: ReportDimension, key: string): string => {
    if (key === '—') return r.unassigned;
    if (dim === 'category') return localizeCategoryName(key, m) || key;
    if (dim === 'place') return localizePlaceName(key, key, m);
    if (dim === 'member') {
      const member = members.find((mem) => mem.id === key || mem.userId === key);
      return member?.displayName || localizePersonName(key, m);
    }
    return `#${key}`;
  };

  const filterValues = useMemo(
    () => (filterDim ? reportDimensionValues(window, filterDim) : []),
    [window, filterDim],
  );

  const report = useMemo(
    () => buildCustomReport(window, {
      dimension,
      scope,
      filters: filterDim && filterValue ? { [filterDim]: filterValue } : {},
      previousMonths: previous,
    }),
    [window, dimension, scope, filterDim, filterValue, previous],
  );

  if (!unlocked) {
    return (
      <ProLockedCard
        icon="dataset"
        title={r.title}
        body={r.locked}
        onUpgrade={onUpgrade}
      />
    );
  }

  const dimensionOptions: Array<{ value: ReportDimension; label: string }> = [
    { value: 'category', label: r.byCategory },
    { value: 'place', label: r.byPlace },
    { value: 'tag', label: r.byTag },
    ...(workspace === 'household' ? [{ value: 'member' as const, label: r.byMember }] : []),
  ];
  const scopeOptions: Array<{ value: ReportScope; label: string }> = [
    { value: 'all', label: r.scopeAll },
    { value: 'variable', label: r.scopeVariable },
    ...(canSeeFixedBills ? [{ value: 'fixed' as const, label: r.scopeFixed }] : []),
  ];
  const max = report.rows[0]?.amount || 1;
  const pct = (v: number) => new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }).format(v);

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <AppIcon name="dataset" className="text-[24px] text-primary" />
        <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">{r.title}</h3>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <CustomSelect label={r.groupBy} value={dimension} onChange={(v) => setDimension(v as ReportDimension)} options={dimensionOptions} />
        <CustomSelect label={r.scope} value={scope} onChange={(v) => setScope(v as ReportScope)} options={scopeOptions} />
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">{r.range}</span>
          <div className="flex gap-1">
            {RANGES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRange(n)}
                className={`flex-1 rounded-xl border px-2 py-2 text-xs font-bold ${range === n ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'}`}
              >
                {t(r.monthsShort, { count: n })}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <CustomSelect
          label={r.filter}
          value={filterDim}
          onChange={(v) => { setFilterDim(v as ReportDimension | ''); setFilterValue(''); }}
          options={[{ value: '', label: r.noFilter }, ...dimensionOptions.filter((o) => o.value !== dimension)]}
        />
        {filterDim && (
          <CustomSelect
            label={r.filterValue}
            value={filterValue}
            onChange={setFilterValue}
            options={[{ value: '', label: r.any }, ...filterValues.map((v) => ({ value: v, label: label(filterDim, v) }))]}
          />
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t(r.totalCount, { count: report.count })}</span>
        <span className="font-mono text-lg font-extrabold text-on-surface">{format(report.total)}</span>
      </div>

      {report.rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-outline-variant p-4 text-center text-sm text-on-surface-variant">{r.empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {report.rows.slice(0, 12).map((row) => {
            const prev = report.previous.get(row.key);
            const delta = prev && prev > 0 ? (row.amount - prev) / prev : null;
            return (
              <li key={row.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-bold text-on-surface">{label(dimension, row.key)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {delta !== null && (
                      <span className={`text-[11px] font-bold ${delta > 0 ? 'text-error' : 'text-primary'}`}>
                        {delta > 0 ? '▲' : '▼'} {pct(Math.abs(delta))}
                      </span>
                    )}
                    <span className="text-[11px] text-on-surface-variant">{pct(row.share)}</span>
                    <span className="font-mono font-bold text-on-surface">{format(row.amount)}</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-outline-variant" aria-hidden="true">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(row.amount / max) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
