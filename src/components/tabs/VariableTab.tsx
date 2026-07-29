import { AppIcon } from '@/components/ui/app-icon';
import React, { useState } from 'react';
import { MonthBudget, VariableExpense } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface VariableTabProps {
  month: MonthBudget;
  onOpenAddModal: () => void;
  onEditExpense: (exp: VariableExpense) => void;
  onManageCategories: () => void;
}

export function VariableTab({
  month,
  onOpenAddModal,
  onEditExpense,
  onManageCategories,
}: VariableTabProps) {
  const { format } = useCurrency();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPerson, setSelectedPerson] = useState<string>('All');
  const [search, setSearch] = useState<string>('');

  const categories = ['All', ...(month.activeCategories || [])];
  const persons = ['All', 'Self', 'Partner', 'Family', 'Queen', 'King'];

  const filteredExpenses = (month.variableExpenses || []).filter((exp) => {
    const matchesCategory = selectedCategory === 'All' || exp.type === selectedCategory;
    const matchesPerson = selectedPerson === 'All' || (exp.person || 'Self') === selectedPerson;
    const matchesSearch =
      exp.name.toLowerCase().includes(search.toLowerCase()) ||
      exp.type.toLowerCase().includes(search.toLowerCase()) ||
      (exp.note && exp.note.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesPerson && matchesSearch;
  });

  const totalSpent = (month.variableExpenses || []).reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="flex flex-col gap-lg pb-24">
      {/* Header & Total */}
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant flex justify-between items-center">
        <div>
          <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
            TOTAL VARIABLE SPENT
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-0.5">
            {format(totalSpent)}
          </h2>
        </div>
        <div className="flex gap-sm">
          <button
            onClick={onManageCategories}
            className="p-3 bg-surface hover:bg-surface-variant text-on-surface border border-outline-variant rounded-xl font-label-md text-label-md font-semibold flex items-center gap-xs"
            title="Manage Categories"
          >
            <AppIcon name="label" className=" text-[20px]" />
          </button>
          <button
            onClick={onOpenAddModal}
            className="px-4 py-3 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold flex items-center gap-xs shadow-sm hover:shadow-md transition-all"
          >
            <AppIcon name="add" className=" text-[20px]" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Search & Category Chips */}
      <div className="flex flex-col gap-md">
        <div className="relative">
          <AppIcon name="search" className=" absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses or notes..."
            className="w-full pl-10 pr-md py-3 bg-surface-container border border-outline-variant rounded-xl font-body-md text-body-md text-on-surface focus:border-primary transition-all outline-none shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-xs overflow-x-auto pb-xs no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-primary text-on-primary font-bold shadow-xs'
                  : 'bg-surface border border-outline-variant text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Expense List */}
      {filteredExpenses.length === 0 ? (
        <div className="p-xl bg-surface-container/40 rounded-2xl border border-dashed border-outline-variant flex flex-col items-center justify-center text-center gap-sm">
          <AppIcon name="search_off" className=" text-outline text-[44px]" />
          <p className="font-body-md text-body-md text-on-surface-variant">No matching variable expenses found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {filteredExpenses.map((exp) => (
            <div
              key={exp.id}
              onClick={() => onEditExpense(exp)}
              className="p-md bg-surface-container rounded-2xl border border-outline-variant flex justify-between items-center hover:border-primary transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-md">
                <div className="p-2.5 bg-surface-container rounded-xl text-primary font-bold shrink-0">
                  <AppIcon name={month.categoryIcons?.[exp.type] || 'shopping_bag'} className=" text-[22px]" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-xs">
                    <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      {exp.name}
                    </span>
                    {exp.person && exp.person !== 'Self' && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] font-bold">
                        {exp.person}
                      </span>
                    )}
                    {exp.receiptUrl && (
                      <AppIcon name="receipt_long" className="text-[16px] text-primary" title="Has receipt" />
                    )}
                  </div>
                  <div className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                    <span>{exp.type}</span>
                    <span>•</span>
                    <span className="capitalize">{exp.place}</span>
                    <span>•</span>
                    <span>{exp.date}</span>
                  </div>
                  {exp.note && (
                    <span className="font-body-sm text-body-sm text-on-surface-variant italic mt-0.5">
                      "{exp.note}"
                    </span>
                  )}
                </div>
              </div>

              <span className="font-mono font-extrabold text-headline-sm text-on-surface">
                -{format(exp.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
