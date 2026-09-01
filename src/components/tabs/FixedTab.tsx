import { AppIcon } from '@/components/ui/app-icon';
import React from 'react';
import { MonthBudget, FixedExpense } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { localizeCategoryName, localizePersonName, localizePlaceName, formatLocalizedDayOfMonth } from '@/lib/localized-labels';
import { parseDueDay } from '@/components/ui/day-picker';

interface FixedTabProps {
  month: MonthBudget;
  onOpenAddModal: () => void;
  onEditBill: (bill: FixedExpense) => void;
  /** False when the household role may read fixed bills but not change them. */
  canEdit?: boolean;
}

export function FixedTab({ month, onOpenAddModal, onEditBill, canEdit = true }: FixedTabProps) {
  const { format } = useCurrency();
  const { messages: m, t, language, intlLocale } = useLanguage();

  const totalFixed = (month.fixedExpenses || []).reduce((acc, b) => acc + b.amount, 0);

  return (
    <div className="flex flex-col gap-lg pb-24">
      {/* Header Banner */}
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant flex justify-between items-center">
        <div>
          <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
            {m.tabs.fixed.totalCommitments}
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-0.5">
            {format(totalFixed)}
          </h2>
        </div>
        {canEdit && (
          <button
            onClick={onOpenAddModal}
            className="px-4 py-3 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold flex items-center gap-xs shadow-sm hover:shadow-md transition-all"
          >
            <AppIcon name="add" className=" text-[20px]" />
            <span>{m.tabs.fixed.addCharge}</span>
          </button>
        )}
      </div>

      {/* Fixed Bills List */}
      {(month.fixedExpenses || []).length === 0 ? (
        <div className="p-xl bg-surface-container/40 rounded-2xl border border-dashed border-outline-variant flex flex-col items-center justify-center text-center gap-sm">
          <AppIcon name="event_repeat" className=" text-outline text-[44px]" />
          <p className="font-body-md text-body-md text-on-surface-variant">{m.tabs.fixed.noCharges}</p>
          {canEdit && (
            <button
              onClick={onOpenAddModal}
              className="mt-xs px-4 py-2 bg-primary text-on-primary font-label-md text-label-md rounded-xl font-bold"
            >
              {m.tabs.fixed.addRentBills}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {month.fixedExpenses.map((bill) => {
            const dueDay = parseDueDay(bill.date || '');
            const dueLabel = dueDay
              ? formatLocalizedDayOfMonth(dueDay, language, intlLocale)
              : m.tabs.fixed.monthly;

            return (
            <div
              key={bill.id}
              role={canEdit ? 'button' : undefined}
              onClick={canEdit ? () => onEditBill(bill) : undefined}
              className={`p-md bg-surface-container rounded-2xl border border-outline-variant flex min-w-0 justify-between items-center gap-3 transition-all shadow-2xs ${
                canEdit ? 'hover:border-primary cursor-pointer' : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-md">
                <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
                  <AppIcon name="receipt_long" className=" text-[24px]" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex min-w-0 items-center gap-xs">
                    <h4 className="min-w-0 truncate font-headline-sm text-headline-sm text-on-surface font-bold" title={bill.name}>
                      {bill.name}
                    </h4>
                    {bill.person && bill.person !== 'Self' && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] font-bold">
                        {localizePersonName(bill.person, m)}
                      </span>
                    )}
                    {bill.recurring && (
                      <AppIcon name="sync" className="text-[16px] text-primary" title={m.tabs.fixed.recurringMonthly} />
                    )}
                  </div>
                  <div className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                    <span>{localizeCategoryName(bill.type, m)}</span>
                    <span>•</span>
                    <span>{localizePlaceName(bill.place, bill.place, m)}</span>
                    <span>•</span>
                    <span>{t(m.tabs.fixed.due, { date: dueLabel })}</span>
                  </div>
                </div>
              </div>

              <span className="font-mono font-extrabold text-headline-sm text-on-surface">
                {format(bill.amount)}
              </span>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
