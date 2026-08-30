import { AppIcon } from '@/components/ui/app-icon';
import { FormattedAmount } from '@/components/ui/formatted-amount';
import React, { useState } from 'react';
import { MonthBudget, VariableExpense, updateCategoryBudget, updateDefaultCategoryBudget, calculateCategorySpent, UserProfile } from '../../lib/store';
import { formatShortDate } from '../../lib/utils';
import { useCurrency } from '../../lib/currency-context';
import { useAuth } from '../../lib/auth-context';
import { isProUser } from '../../lib/pro-features';
import { useHousehold } from '../../lib/household-context';
import { canShowProUpgrade, isProFeatureUnlocked } from '../../lib/household';

interface VariableTabProps {
  month: MonthBudget;
  onOpenAddModal: () => void;
  onEditExpense: (exp: VariableExpense) => void;
  onUpdateMonth: (month: MonthBudget) => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onOpenProModal: () => void;
}

export function VariableTab({
  month,
  onOpenAddModal,
  onEditExpense,
  onUpdateMonth,
  onUpdateProfile,
  onOpenProModal,
}: VariableTabProps) {
  const { format } = useCurrency();
  const { profile } = useAuth();
  const isPro = isProUser(profile);
  const { workspace } = useHousehold();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPerson, setSelectedPerson] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState<string>('');

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

  const handleSetBudget = (category: string) => {
    const amount = parseFloat(budgetInput);
    if (!isNaN(amount) && amount >= 0) {
      // Update current month
      const updatedMonth = updateCategoryBudget(month, category, amount);
      onUpdateMonth(updatedMonth);
      
      // Update user profile defaults (for future months)
      if (profile) {
        const updatedProfile = updateDefaultCategoryBudget(profile, category, amount);
        onUpdateProfile(updatedProfile);
      }
    }
    setEditingCategory(null);
    setBudgetInput('');
  };

  const handleStartEdit = (category: string) => {
    if (!isProFeatureUnlocked(isPro, workspace)) {
      onOpenProModal();
      return;
    }
    setEditingCategory(category);
    const currentBudget = month.categoryBudgets?.[category] || 0;
    setBudgetInput(currentBudget > 0 ? currentBudget.toString() : '');
  };

  return (
    <div className="flex flex-col gap-lg pb-24">
      {/* Header & Total */}
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant flex justify-between items-center">
        <div>
          <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
            TOTAL VARIABLE SPENT
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-0.5">
            <FormattedAmount value={totalSpent} />
          </h2>
        </div>
        <button
          onClick={onOpenAddModal}
          className="px-4 py-3 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold flex items-center gap-xs shadow-sm hover:shadow-md transition-all"
        >
          <AppIcon name="add" className=" text-[20px]" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Category Budgets (Pro Feature) */}
      <div className="bg-surface-container rounded-3xl border border-outline-variant p-lg shadow-2xs">
        <div className="flex justify-between items-center mb-md">
          <h3 className="font-headline-md text-headline-md text-on-surface font-extrabold">
            Category Budgets
          </h3>
          {canShowProUpgrade(isPro, workspace) && (
            <button
              onClick={onOpenProModal}
              className="px-3 py-1.5 bg-primary/10 text-primary rounded-full font-label-sm text-label-sm font-bold hover:bg-primary/20 transition-all"
            >
              PRO
            </button>
          )}
        </div>
        
        <div className="flex flex-col gap-md">
          {(month.activeCategories || []).map((category) => {
            const budget = month.categoryBudgets?.[category] || 0;
            const spent = calculateCategorySpent(month, category);
            const progress = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
            const isOverBudget = budget > 0 && spent > budget;
            const isEditing = editingCategory === category;

            return (
              <div key={category} className="flex flex-col gap-sm">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <AppIcon 
                        name={month.categoryIcons?.[category] || 'category'} 
                        className="text-[18px] text-primary" 
                      />
                    </div>
                    <span className="font-label-lg text-label-lg font-bold text-on-surface">
                      {category}
                    </span>
                  </div>
                  
                  {isEditing ? (
                    <div className="flex items-center gap-xs">
                      <input
                        type="number"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSetBudget(category);
                          if (e.key === 'Escape') {
                            setEditingCategory(null);
                            setBudgetInput('');
                          }
                        }}
                        placeholder="0"
                        className="w-24 px-2 py-1 bg-surface border border-outline-variant rounded-lg font-mono text-base text-on-surface focus:border-primary outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSetBudget(category)}
                        className="p-1 text-primary hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <AppIcon name="check" className="text-[18px]" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingCategory(null);
                          setBudgetInput('');
                        }}
                        className="p-1 text-on-surface-variant hover:bg-surface-variant rounded-lg transition-all"
                      >
                        <AppIcon name="close" className="text-[18px]" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartEdit(category)}
                      className="flex items-center gap-xs text-on-surface-variant hover:text-primary transition-all"
                    >
                      <span className="font-mono font-bold text-sm">
                        {format(spent)}
                      </span>
                      {budget > 0 && (
                        <>
                          <span className="text-xs">/</span>
                          <span className="font-mono font-bold text-sm text-on-surface-variant">
                            {format(budget)}
                          </span>
                        </>
                      )}
                      <AppIcon name="edit" className="text-[14px]" />
                    </button>
                  )}
                </div>
                
                {budget > 0 && (
                  <>
                    <div className="w-full h-2 bg-outline-variant rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isOverBudget ? 'bg-error' : progress >= 80 ? 'bg-amber-500' : 'bg-primary'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className={`font-bold ${isOverBudget ? 'text-error' : 'text-on-surface-variant'}`}>
                        {progress.toFixed(0)}% used
                      </span>
                      <span className="font-mono text-on-surface-variant">
                        {isOverBudget 
                          ? `Over by ${format(spent - budget)}`
                          : `${format(budget - spent)} left`
                        }
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
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
            className="w-full pl-10 pr-md py-3 bg-surface-container border border-outline-variant rounded-xl font-body-md text-base md:text-body-md text-on-surface focus:border-primary transition-all outline-none shadow-2xs"
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
              className="flex min-w-0 items-center justify-between gap-3 p-md bg-surface-container rounded-2xl border border-outline-variant hover:border-primary transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="p-2.5 bg-surface-container rounded-xl text-primary font-bold shrink-0">
                  <AppIcon name={month.categoryIcons?.[exp.type] || 'shopping_bag'} className=" text-[22px]" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate font-headline-sm text-headline-sm text-on-surface font-semibold">
                      {exp.name}
                    </span>
                    {exp.person && exp.person !== 'Self' && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] font-bold">
                        {exp.person}
                      </span>
                    )}
                    {exp.receiptUrl && (
                      <AppIcon name="receipt_long" className="shrink-0 text-[16px] text-primary" title="Has receipt" />
                    )}
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                    <span className="min-w-0 truncate">{exp.type}</span>
                    <span className="shrink-0">•</span>
                    <span className="shrink-0 capitalize">{exp.place}</span>
                    <span className="shrink-0">•</span>
                    <time dateTime={exp.date} className="shrink-0 whitespace-nowrap">
                      {formatShortDate(exp.date)}
                    </time>
                  </div>
                  {exp.note && (
                    <span className="mt-0.5 truncate font-body-sm text-body-sm text-on-surface-variant italic">
                      "{exp.note}"
                    </span>
                  )}
                </div>
              </div>

              <FormattedAmount
                value={exp.amount}
                prefix="-"
                className="shrink-0 font-mono font-extrabold text-headline-sm text-on-surface"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
