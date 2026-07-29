import { AppIcon } from '@/components/ui/app-icon';
import React from 'react';
import { MonthBudget, FixedExpense } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface FixedTabProps {
  month: MonthBudget;
  onOpenAddModal: () => void;
  onEditBill: (bill: FixedExpense) => void;
}

export function FixedTab({ month, onOpenAddModal, onEditBill }: FixedTabProps) {
  const { format } = useCurrency();

  const totalFixed = (month.fixedExpenses || []).reduce((acc, b) => acc + b.amount, 0);

  return (
    <div className="flex flex-col gap-lg pb-24">
      {/* Header Banner */}
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant flex justify-between items-center">
        <div>
          <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
            MONTHLY FIXED COMMITMENTS
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-0.5">
            {format(totalFixed)}
          </h2>
        </div>
        <button
          onClick={onOpenAddModal}
          className="px-4 py-3 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold flex items-center gap-xs shadow-sm hover:shadow-md transition-all"
        >
          <AppIcon name="add" className=" text-[20px]" />
          <span>Add Charge</span>
        </button>
      </div>

      {/* Fixed Bills List */}
      {(month.fixedExpenses || []).length === 0 ? (
        <div className="p-xl bg-surface-container/40 rounded-2xl border border-dashed border-outline-variant flex flex-col items-center justify-center text-center gap-sm">
          <AppIcon name="event_repeat" className=" text-outline text-[44px]" />
          <p className="font-body-md text-body-md text-on-surface-variant">No fixed monthly charges configured.</p>
          <button
            onClick={onOpenAddModal}
            className="mt-xs px-4 py-2 bg-primary text-on-primary font-label-md text-label-md rounded-xl font-bold"
          >
            Add Rent, Bills or Subscriptions
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {month.fixedExpenses.map((bill) => (
            <div
              key={bill.id}
              onClick={() => onEditBill(bill)}
              className="p-md bg-surface rounded-2xl border border-outline-variant flex justify-between items-center hover:border-primary transition-all cursor-pointer"
            >
              <div className="flex items-center gap-md">
                <div className="p-3 bg-primary/10 text-primary rounded-xl">
                  <AppIcon name="receipt_long" className=" text-[24px]" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-xs">
                    <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      {bill.name}
                    </h4>
                    {bill.person && bill.person !== 'Self' && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] font-bold">
                        {bill.person}
                      </span>
                    )}
                    {bill.recurring && (
                      <AppIcon name="sync" className="text-[16px] text-primary" title="Recurring monthly" />
                    )}
                  </div>
                  <div className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                    <span>{bill.type}</span>
                    <span>•</span>
                    <span className="capitalize">{bill.place}</span>
                    <span>•</span>
                    <span>Due {bill.date || 'Monthly'}</span>
                  </div>
                </div>
              </div>

              <span className="font-mono font-extrabold text-headline-sm text-on-surface">
                {format(bill.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
