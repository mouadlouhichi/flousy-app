import { AppIcon } from '@/components/ui/app-icon';
import { FormattedAmount } from '@/components/ui/formatted-amount';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MonthBudget, VariableExpense, updateCategoryBudget, updateDefaultCategoryBudget, calculateCategorySpent, envelopeFor, UserProfile } from '../../lib/store';
import { formatShortDate } from '../../lib/utils';
import { useCurrency } from '../../lib/currency-context';
import { useAuth } from '../../lib/auth-context';
import { isProUser } from '../../lib/pro-features';
import { useHousehold } from '../../lib/household-context';
import { canShowProUpgrade, isProFeatureUnlocked } from '../../lib/household';
import { useLanguage } from '@/lib/i18n-context';
import { formatLocalizedPercent } from '@/lib/i18n';
import { localizeCategoryName, localizePersonName, localizePlaceName } from '@/lib/localized-labels';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { IconSelect } from '@/components/ui/icon-select';
import { ExpenseSort, sortVariableExpenses } from '@/lib/expense-sort';

function expenseDay(date: string): string {
  return (date || '').slice(0, 10);
}

interface VariableTabProps {
  month: MonthBudget;
  onOpenAddModal: () => void;
  onEditExpense: (exp: VariableExpense) => void;
  onUpdateMonth: (month: MonthBudget) => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onOpenProModal: () => void;
  /** Explicit needs/wants override; absent when the member cannot edit settings. */
  onSetCategoryEnvelope?: (category: string, envelope: 'needs' | 'wants') => void;
  /** False when the household role may read expenses but not change them. */
  canEdit?: boolean;
  /** Category budgets live in `settings`, a separate area from `expenses`. */
  canEditCategoryBudgets?: boolean;
}

export function VariableTab({
  month,
  onOpenAddModal,
  onEditExpense,
  onUpdateMonth,
  onUpdateProfile,
  onOpenProModal,
  onSetCategoryEnvelope,
  canEdit = true,
  canEditCategoryBudgets = true,
}: VariableTabProps) {
  const { format } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const router = useRouter();
  const { profile } = useAuth();
  const isPro = isProUser(profile);
  const { workspace, household } = useHousehold();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPerson, setSelectedPerson] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<ExpenseSort>('newest');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState<string>('');
  const [budgetsOpen, setBudgetsOpen] = useState(false);

  const categories = ['All', ...(month.activeCategories || [])];
  const persons = ['All', 'Self', 'Partner', 'Family', 'Queen', 'King'];

  const filteredExpenses = sortVariableExpenses(
    (month.variableExpenses || []).filter((exp) => {
      const matchesCategory = selectedCategory === 'All' || exp.type === selectedCategory;
      const matchesPerson = selectedPerson === 'All' || (exp.person || 'Self') === selectedPerson;
      const matchesSearch =
        exp.name.toLowerCase().includes(search.toLowerCase()) ||
        exp.type.toLowerCase().includes(search.toLowerCase()) ||
        (exp.note && exp.note.toLowerCase().includes(search.toLowerCase()));
      const day = expenseDay(exp.date);
      const rangeEnd = dateTo || dateFrom;
      const matchesFrom = !dateFrom || day >= dateFrom;
      const matchesTo = !rangeEnd || day <= rangeEnd;
      return matchesCategory && matchesPerson && matchesSearch && matchesFrom && matchesTo;
    }),
    sortBy,
    intlLocale,
  );

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
    if (!canEditCategoryBudgets) return;
    if (!isProFeatureUnlocked(isPro, workspace, household)) {
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
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant flex justify-between items-center gap-3">
        <div className="min-w-0">
          <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
            {m.tabs.variable.totalSpent}
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-0.5">
            <FormattedAmount value={totalSpent} />
          </h2>
        </div>
        {canEdit && (
          <button
            onClick={onOpenAddModal}
            className="shrink-0 px-4 py-3 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold flex items-center gap-xs shadow-sm hover:shadow-md transition-all"
          >
            <AppIcon name="add" className=" text-[20px]" />
            <span>{m.tabs.variable.addExpense}</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => router.push('/dashboard/courses')}
        className="flex w-full items-center gap-3 rounded-3xl border border-outline-variant bg-surface-container px-4 py-3.5 text-start hover:border-primary hover:bg-surface-container-high transition-all"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <AppIcon name="scan_barcode" className="text-[22px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-headline-sm text-headline-sm font-bold text-on-surface">
            {m.courses.newCourse}
          </span>
          <span className="block truncate font-label-sm text-label-sm text-on-surface-variant">
            {m.courses.emptyHint}
          </span>
        </span>
        <AppIcon name="chevron_right" className="size-5 shrink-0 text-on-surface-variant rtl:rotate-180" />
      </button>

      {/* Category Budgets (Pro Feature) */}
      <div className="bg-surface-container rounded-3xl border border-outline-variant shadow-2xs">
        <button
          type="button"
          onClick={() => setBudgetsOpen((open) => !open)}
          aria-expanded={budgetsOpen}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-start"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <AppIcon name="sliders-horizontal" className="text-[22px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-headline-sm text-headline-sm font-bold text-on-surface">
              {m.tabs.variable.categoryBudgets}
            </span>
            <span className="block truncate font-label-sm text-label-sm text-on-surface-variant">
              {m.tabs.variable.categoryBudgetsHint}
            </span>
          </span>
          {canShowProUpgrade(isPro, workspace) && (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onOpenProModal();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  onOpenProModal();
                }
              }}
              className="shrink-0 px-3 py-1.5 bg-primary/10 text-primary rounded-full font-label-sm text-label-sm font-bold hover:bg-primary/20 transition-all"
            >
              {m.tabs.variable.pro}
            </span>
          )}
          <AppIcon
            name="expand_more"
            className={`ms-1 size-7 shrink-0 text-on-surface-variant transition-transform ${budgetsOpen ? 'rotate-180' : ''}`}
          />
        </button>
        
        {budgetsOpen && <div className="mt-md flex flex-col gap-md px-4 pb-4">
          {(month.activeCategories || []).map((category) => {
            const budget = month.categoryBudgets?.[category] || 0;
            const spent = calculateCategorySpent(month, category);
            const progress = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
            const isOverBudget = budget > 0 && spent > budget;
            const isEditing = editingCategory === category;
            const envelope = envelopeFor(month.categoryEnvelopes, category, 'variable');

            return (
              <div key={category} className="flex flex-col gap-sm">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-sm min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <AppIcon 
                        name={month.categoryIcons?.[category] || 'category'} 
                        className="text-[18px] text-primary" 
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-lg text-label-lg font-bold text-on-surface truncate">
                        {localizeCategoryName(category, m)}
                      </span>
                      {onSetCategoryEnvelope ? (
                        <div className="flex items-center gap-1 mt-0.5" role="group" aria-label={t(m.tabs.variable.envelopeLabel, { category: localizeCategoryName(category, m) })}>
                          {(['needs', 'wants'] as const).map((env) => (
                            <button
                              key={env}
                              type="button"
                              onClick={() => envelope !== env && onSetCategoryEnvelope(category, env)}
                              aria-pressed={envelope === env}
                              className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-bold transition-all ${
                                envelope === env
                                  ? env === 'needs'
                                    ? 'bg-primary text-on-primary'
                                    : 'bg-tertiary text-on-tertiary'
                                  : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                              }`}
                            >
                              {env === 'needs' ? m.tabs.variable.envelopeNeeds : m.tabs.variable.envelopeWants}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
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
                        aria-label={t(m.tabs.variable.editBudget, { category: localizeCategoryName(category, m) })}
                        className="w-24 px-2 py-1 bg-surface border border-outline-variant rounded-lg font-mono text-base text-on-surface focus:border-primary outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSetBudget(category)}
                        aria-label={t(m.tabs.variable.saveBudget, { category: localizeCategoryName(category, m) })}
                        className="tap-target p-1 text-primary hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <AppIcon name="check" className="text-[18px]" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingCategory(null);
                          setBudgetInput('');
                        }}
                        aria-label={m.tabs.variable.cancelBudgetEdit}
                        className="tap-target p-1 text-on-surface-variant hover:bg-surface-variant rounded-lg transition-all"
                      >
                        <AppIcon name="close" className="text-[18px]" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartEdit(category)}
                      aria-label={t(m.tabs.variable.editBudget, { category: localizeCategoryName(category, m) })}
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
                        {t(m.tabs.variable.percentUsed, { percent: formatLocalizedPercent(progress, intlLocale) })}
                      </span>
                      <span className="font-mono text-on-surface-variant">
                        {isOverBudget 
                          ? t(m.tabs.variable.overBy, { amount: format(spent - budget) })
                          : t(m.tabs.variable.left, { amount: format(budget - spent) })
                        }
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>}
      </div>

      {/* Search & Category Chips */}
      <div className="flex flex-col gap-md">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <AppIcon name="search" className=" absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={m.tabs.variable.searchPlaceholder}
              aria-label={m.tabs.variable.searchPlaceholder}
              className="h-12 w-full ps-10 pe-md bg-surface-container border border-outline-variant rounded-xl font-body-md text-base md:text-body-md text-on-surface focus:border-primary transition-all outline-none shadow-2xs"
            />
          </div>
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={(nextFrom, nextTo) => {
              setDateFrom(nextFrom);
              setDateTo(nextTo);
            }}
            ariaLabel={m.tabs.variable.dateFrom}
          />
          <IconSelect
            value={sortBy}
            onChange={(value) => setSortBy(value as ExpenseSort)}
            ariaLabel={m.tabs.variable.sortLabel}
            icon="sort"
            isActive={sortBy !== 'newest'}
            options={[
              { value: 'newest', label: m.tabs.variable.sortNewest },
              { value: 'oldest', label: m.tabs.variable.sortOldest },
              { value: 'amountHigh', label: m.tabs.variable.sortAmountHigh },
              { value: 'amountLow', label: m.tabs.variable.sortAmountLow },
              { value: 'name', label: m.tabs.variable.sortName },
            ]}
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
              {cat === 'All' ? m.common.all : localizeCategoryName(cat, m)}
            </button>
          ))}
        </div>
      </div>

      {/* Expense List */}
      {filteredExpenses.length === 0 ? (
        <div className="p-xl bg-surface-container/40 rounded-2xl border border-dashed border-outline-variant flex flex-col items-center justify-center text-center gap-sm">
          <AppIcon name="search_off" className=" text-outline text-[44px]" />
          <p className="font-body-md text-body-md text-on-surface-variant">{m.tabs.variable.noResults}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {filteredExpenses.map((exp) => (
            <div
              key={exp.id}
              role={canEdit ? 'button' : undefined}
              tabIndex={canEdit ? 0 : undefined}
              onClick={canEdit ? () => onEditExpense(exp) : undefined}
              onKeyDown={canEdit ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onEditExpense(exp);
                }
              } : undefined}
              className={`flex min-w-0 items-center justify-between gap-3 p-md bg-surface-container rounded-2xl border border-outline-variant transition-all shadow-2xs ${
                canEdit ? 'hover:border-primary cursor-pointer' : ''
              }`}
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
                        {localizePersonName(exp.person, m)}
                      </span>
                    )}
                    {exp.receiptUrl && (
                      <AppIcon name="receipt_long" className="shrink-0 text-[16px] text-primary" title={m.tabs.variable.hasReceipt} />
                    )}
                  </div>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 font-label-sm text-label-sm text-on-surface-variant">
                    <span className="min-w-0 truncate">{localizeCategoryName(exp.type, m)}</span>
                    <span className="shrink-0">•</span>
                    <span className="min-w-0 truncate">{localizePlaceName(exp.place, exp.place, m)}</span>
                    <span className="shrink-0">•</span>
                    <time dateTime={exp.date} className="min-w-0 truncate">
                      {formatShortDate(exp.date, intlLocale)}
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
