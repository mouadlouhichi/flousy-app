'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppIcon } from '@/components/ui/app-icon';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { localizeCategoryName } from '@/lib/localized-labels';
import { searchTransactions, type SearchHit } from '@/lib/insights';
import { formatShortDate } from '@/lib/utils';
import { ProLockedCard } from '../pro-locked-card';

export function SearchScreen() {
  const router = useRouter();
  const { month, currentMonthKey, trendsMonths, trendsLoading, proUnlocked, openProModal, goToMonth } = useDashboard();
  const { canViewArea } = useHousehold();
  const { format } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const s = m.search;
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const canSeeExpenses = canViewArea('expenses');
  const canSeeBills = canViewArea('fixedBills');
  const canSeeDebts = canViewArea('debts');

  const corpus = useMemo(() => {
    // Free plan: current month only. Pro: every loaded month (deduped).
    const list = proUnlocked && trendsMonths.length
      ? trendsMonths
      : [{ monthKey: currentMonthKey, month }];
    return list.map(({ monthKey, month: mo }) => ({
      monthKey,
      month: {
        ...mo,
        variableExpenses: canSeeExpenses ? mo.variableExpenses : [],
        fixedExpenses: canSeeBills ? mo.fixedExpenses : [],
        debts: canSeeDebts ? mo.debts : [],
      },
    }));
  }, [proUnlocked, trendsMonths, currentMonthKey, month, canSeeExpenses, canSeeBills, canSeeDebts]);

  const hits = useMemo(
    () => (debounced.trim().length >= 2 || debounced.startsWith('#') ? searchTransactions(corpus, debounced) : []),
    [corpus, debounced],
  );

  const kindLabel: Record<SearchHit['kind'], string> = {
    variable: s.kindVariable,
    fixed: s.kindFixed,
    debt: s.kindDebt,
  };
  const kindHref: Record<SearchHit['kind'], string> = {
    variable: '/dashboard/variable',
    fixed: '/dashboard/fixed',
    debt: '/dashboard/debts',
  };

  const open = (hit: SearchHit) => {
    if (hit.monthKey !== currentMonthKey) goToMonth(hit.monthKey);
    router.push(kindHref[hit.kind]);
  };

  return (
    <div className="flex flex-col gap-4 pb-24">
      <label className="flex items-center gap-3 rounded-3xl border border-outline-variant bg-surface-container px-4 py-3 focus-within:border-primary">
        <AppIcon name="search" className="text-[22px] text-on-surface-variant" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={s.placeholder}
          className="w-full bg-transparent text-base text-on-surface outline-none placeholder:text-on-surface-variant"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label={m.common.close} className="text-on-surface-variant">
            <AppIcon name="close" className="text-[18px]" />
          </button>
        )}
      </label>

      {!proUnlocked && (
        <ProLockedCard
          icon="search"
          title={m.profile.pro.features.search.title}
          body={m.profile.pro.features.search.description}
          onUpgrade={openProModal}
        />
      )}

      {trendsLoading && proUnlocked && (
        <p className="text-xs font-semibold text-on-surface-variant">{s.loading}</p>
      )}

      {debounced.trim().length < 2 && !debounced.startsWith('#') ? (
        <p className="text-sm text-on-surface-variant">{s.hint}</p>
      ) : hits.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{t(s.empty, { query: debounced })}</p>
      ) : (
        <>
          <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{t(s.results, { count: hits.length })}</p>
          <ul className="flex flex-col gap-2">
            {hits.map((hit) => (
              <li key={`${hit.monthKey}:${hit.kind}:${hit.id}`}>
                <button
                  type="button"
                  onClick={() => open(hit)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-start transition-colors hover:border-primary/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-on-surface">{hit.name}</span>
                    <span className="block truncate text-xs text-on-surface-variant">
                      {kindLabel[hit.kind]} · {hit.kind === 'debt' ? hit.category : localizeCategoryName(hit.category, m)} · {formatShortDate(hit.date, intlLocale)}
                      {hit.tags.length > 0 && ` · ${hit.tags.map((tag) => `#${tag}`).join(' ')}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="block font-mono text-sm font-bold text-on-surface">{format(hit.amount)}</span>
                    <span className="block text-[10px] font-semibold uppercase text-on-surface-variant">{hit.monthKey}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
