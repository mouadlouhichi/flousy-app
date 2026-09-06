'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { analyzeInci, groupInciFlags } from '@/lib/inci-quality';
import { useLanguage } from '@/lib/i18n-context';

/**
 * Cosmetic quality check for a scanned product: summarizes the INCI
 * ingredient list (from Open Beauty Facts) — flags commonly concerning
 * ingredients and lets the user expand the full list.
 */
export function ProductQualityPanel({ ingredients }: { ingredients: string[] }) {
  const { messages: m, t } = useLanguage();
  const q = m.barcode.quality;
  const [listOpen, setListOpen] = useState(false);

  const quality = analyzeInci(ingredients);
  const groups = groupInciFlags(quality.flags);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">
          <AppIcon name="science" className="text-[16px] text-primary" />
          {q.title}
        </span>
        {quality.status === 'clean' ? (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
            <AppIcon name="check_circle" className="text-[14px]" />
            {q.ok}
          </span>
        ) : (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              quality.status === 'concern' ? 'bg-error/10 text-error' : 'bg-tertiary-container/50 text-tertiary'
            }`}
          >
            <AppIcon name="warning" className="text-[14px]" />
            {t(q.flagCount, { count: groups.length })}
          </span>
        )}
      </div>

      {groups.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {groups.map((group) => (
            <li key={group.key} className="flex items-start gap-1.5 text-xs">
              <span
                className={`mt-1 size-1.5 shrink-0 rounded-full ${
                  group.severity === 'high' ? 'bg-error' : 'bg-tertiary'
                }`}
              />
              <span className="min-w-0">
                <span className="font-bold text-on-surface">{(q.flags as Record<string, string>)[group.key]}</span>
                <span className="block truncate font-mono text-[10px] text-on-surface-variant" title={group.incis.join(', ')}>
                  {group.incis.join(', ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setListOpen((open) => !open)}
        className="mt-2 flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
        aria-expanded={listOpen}
      >
        <AppIcon name={listOpen ? 'expand_more' : 'chevron_right'} className="text-[14px]" />
        {listOpen ? q.hideList : t(q.showList, { count: quality.total })}
      </button>

      {listOpen && (
        <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
          {ingredients.map((ingredient) => (
            <span key={ingredient} className="rounded-md bg-surface-variant px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant">
              {ingredient}
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 text-[10px] text-on-surface-variant">{q.sourceNote}</p>
    </div>
  );
}
