import { AppIcon } from '@/components/ui/app-icon';
import React, { useState } from 'react';
import { FormattedAmount } from '@/components/ui/formatted-amount';
import { CashFlowCalendar } from '../dashboard/cash-flow-calendar';
import { MonthBudget, FixedExpense, fixedCategoryVisual, fixedPaidAmount } from '../../lib/store';
import { useAuth } from '../../lib/auth-context';
import { useHousehold } from '../../lib/household-context';
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
  /** Pro gate for the projected-balance layer of the calendar. */
  forecastUnlocked?: boolean;
  onUpgrade?: () => void;
  /** Whether the viewer may see income sources (calendar income markers). */
  canSeeIncome?: boolean;
}

export function FixedTab({
  month,
  onOpenAddModal,
  onEditBill,
  canEdit = true,
  forecastUnlocked = false,
  onUpgrade,
  canSeeIncome = true,
}: FixedTabProps) {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const { format } = useCurrency();
  const { profile } = useAuth();
  const { workspace, household } = useHousehold();
  const customCategories = workspace === 'household'
    ? (household?.fixedCategories || [])
    : (profile?.fixedCategories || []);
  const { messages: m, t, language, intlLocale } = useLanguage();

  const totalFixed = (month.fixedExpenses || []).reduce((acc, bill) => acc + bill.amount, 0);
  const totalPaid = (month.fixedExpenses || []).reduce((acc, bill) => acc + fixedPaidAmount(bill), 0);

  return (
    <div className="flex flex-col gap-lg pb-24">
      {/* Header Banner */}
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant flex justify-between items-center">
        <div>
          <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
            {m.tabs.fixed.totalCommitments}
          </span>
          {/* The currency code renders AFTER the amount, smaller (FormattedAmount):
              "3 200,00 MAD" — en-US Intl would otherwise lead with "MAD 3,200.00". */}
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-0.5">
            <FormattedAmount value={totalFixed} />
          </h2>
          <p className="mt-1 text-xs font-bold text-primary">
            {t(m.tabs.fixed.paidSummary, { paid: format(totalPaid), total: format(totalFixed) })}
          </p>
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

      {/* List / calendar switch */}
      <div className="flex justify-end">
        <div role="tablist" aria-label={m.cashFlow.title} className="inline-flex rounded-full border border-outline-variant bg-surface-container p-1">
          {(['list', 'calendar'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={view === option}
              onClick={() => setView(option)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                view === option ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <AppIcon name={option === 'list' ? 'view_list' : 'calendar_month'} className="text-[16px]" />
              {option === 'list' ? m.cashFlow.viewList : m.cashFlow.viewCalendar}
            </button>
          ))}
        </div>
      </div>

      {view === 'calendar' && (
        <CashFlowCalendar
          month={month}
          forecastUnlocked={forecastUnlocked}
          onUpgrade={onUpgrade ?? (() => {})}
          showIncome={canSeeIncome}
        />
      )}

      {/* Fixed Bills List */}
      {view === 'calendar' ? null : (month.fixedExpenses || []).length === 0 ? (
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
            // Render the category's own icon + colour (same resolution as the
            // Add/Edit modal) instead of a generic receipt glyph.
            const visual = fixedCategoryVisual(bill.type, {
              icons: month.categoryIcons,
              colors: month.categoryColors,
              custom: customCategories,
            });

            return (
            <button
              type="button"
              key={bill.id}
              onClick={canEdit ? () => onEditBill(bill) : undefined}
              disabled={!canEdit}
              className={`p-md bg-surface-container rounded-2xl border border-outline-variant flex min-w-0 justify-between items-center gap-3 text-start transition-all shadow-2xs ${
                canEdit ? 'hover:border-primary cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-md">
                {/* Same icon treatment as variable-expense rows: neutral
                    container, primary icon, category-specific glyph. */}
                <div className="p-2.5 bg-surface-container rounded-xl text-primary font-bold shrink-0">
                  <AppIcon name={visual.icon} className=" text-[22px]" />
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
                    {bill.recurring !== false && (
                      <AppIcon name="sync" className="text-[16px] text-primary" title={m.tabs.fixed.recurringMonthly} />
                    )}
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {m.tabs.fixed.status[bill.status || 'paid']}
                    </span>
                  </div>
                  <div className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                    <span>{localizeCategoryName(bill.type, m)}</span>
                    <span>•</span>
                    <span>{localizePlaceName(bill.place, bill.place, m)}</span>
                    {/* A one-off (non-recurring) bill has no repeat-on day, so
                        "Due {date}" is only shown when the bill recurs. */}
                    {bill.recurring !== false && (
                      <>
                        <span>•</span>
                        <span>{t(m.tabs.fixed.due, { date: dueLabel })}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <span className="text-end">
                {/* Amount with a smaller currency code after it (not "MAD 3,000.00"). */}
                <FormattedAmount
                  value={bill.amount}
                  className="block font-mono font-extrabold text-headline-sm text-on-surface"
                />
                {fixedPaidAmount(bill) !== bill.amount && (
                  <span className="mt-0.5 flex items-baseline justify-end gap-1 text-[10px] font-bold text-primary">
                    <FormattedAmount
                      value={fixedPaidAmount(bill)}
                      className="font-mono"
                      currencyClassName="text-[0.8em] font-bold text-primary"
                    />
                    {m.tabs.fixed.paidShort}
                  </span>
                )}
              </span>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
