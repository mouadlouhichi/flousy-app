'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useCurrency } from '../../lib/currency-context';
import {
  MonthBudget,
  SavingGoal,
  VariableExpense,
  FixedExpense,
  MoneyPlace,
  normalizeMonth,
  addVariableExpense,
  editVariableExpense,
  deleteVariableExpense,
  addFixedExpense,
  editFixedExpense,
  deleteFixedExpense,
  moveMoney,
  fundGoal,
  withdrawGoal,
  deleteFundedGoal,
  DebtItem,
  addDebt,
  editDebt,
  deleteDebt,
} from '../../lib/store';
import {
  subscribeMonthBudget,
  saveMonthBudget,
  subscribeSavingsGoals,
  saveSavingsGoals,
} from '../../lib/db';

// Tabs
import { OverviewTab } from '../../components/tabs/OverviewTab';
import { VariableTab } from '../../components/tabs/VariableTab';
import { FixedTab } from '../../components/tabs/FixedTab';
import { SavingsTab } from '../../components/tabs/SavingsTab';
import { TrendsTab } from '../../components/tabs/TrendsTab';
import { DebtsTab } from '../../components/tabs/DebtsTab';
import { DebtModal } from '../../components/modals/DebtModal';

// Modals & UI
import { ExpenseModal } from '../../components/modals/ExpenseModal';
import { MoveMoneyModal } from '../../components/modals/MoveMoneyModal';
import { FixedModal } from '../../components/modals/FixedModal';
import { SavingsModal } from '../../components/modals/SavingsModal';
import { SettingsModal } from '../../components/modals/SettingsModal';
import { ManageCategoriesModal } from '../../components/modals/ManageCategoriesModal';
import { ProUpgradeModal } from '../../components/modals/ProUpgradeModal';
import { ImportCsvModal } from '../../components/modals/ImportCsvModal';
import { IncomeSourcesModal } from '../../components/modals/IncomeSourcesModal';
import { BudgetAlerts } from '../../components/ui/BudgetAlerts';

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, sendVerificationEmail, dismissVerificationBanner, setDismissVerificationBanner } = useAuth();
  const { format } = useCurrency();

  // Active Month Key (YYYY-MM)
  const today = new Date();
  const defaultMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(defaultMonthKey);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'variable' | 'fixed' | 'savings' | 'trends'>('overview');

  // Core State
  const [month, setMonth] = useState<MonthBudget>(() => normalizeMonth({ totalBudget: 0 }));
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Auth Protection Effect
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Modal Open States
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<VariableExpense | null>(null);

  const [isMoveMoneyModalOpen, setIsMoveMoneyModalOpen] = useState(false);

  const [isFixedModalOpen, setIsFixedModalOpen] = useState(false);
  const [selectedFixed, setSelectedFixed] = useState<FixedExpense | null>(null);

  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [savingsModalMode, setSavingsModalMode] = useState<'create' | 'fund' | 'withdraw' | 'edit'>('create');
  const [selectedGoal, setSelectedGoal] = useState<SavingGoal | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtItem | null>(null);

  const [verificationSent, setVerificationSent] = useState(false);

  // 1. Subscribe or load month budget
  useEffect(() => {
    setLoading(true);

    if (user) {
      const unsub = subscribeMonthBudget(user.uid, currentMonthKey, (data) => {
        if (data) {
          setMonth(data);
        } else {
          // If no month document exists in Firestore, check local storage or initialize clean default
          const local = localStorage.getItem(`flousy_month_${currentMonthKey}`);
          if (local) {
            try {
              setMonth(normalizeMonth(JSON.parse(local), currentMonthKey));
            } catch {
              setMonth(normalizeMonth({ totalBudget: 0 }, currentMonthKey));
            }
          } else {
            const clean = normalizeMonth({ totalBudget: 0 }, currentMonthKey);
            setMonth(clean);
          }
        }
        setLoading(false);
      });
      return () => unsub();
    } else {
      setMonth(normalizeMonth({ totalBudget: 0 }, currentMonthKey));
      setLoading(false);
    }
  }, [user, currentMonthKey]);

  // 2. Subscribe or load savings goals
  useEffect(() => {
    if (user) {
      const unsub = subscribeSavingsGoals(user.uid, (data) => {
        setGoals(data || []);
      });
      return () => unsub();
    } else {
      setGoals([]);
    }
  }, [user]);

  // Helper to persist month updates locally + cloud
  const updateAndSaveMonth = (newMonth: MonthBudget) => {
    setMonth(newMonth);
    localStorage.setItem(`flousy_month_${currentMonthKey}`, JSON.stringify(newMonth));
    if (user) {
      saveMonthBudget(user.uid, currentMonthKey, newMonth).catch((e) => console.error(e));
    }
  };

  // Helper to persist goals updates locally + cloud
  const updateAndSaveGoals = (newGoals: SavingGoal[]) => {
    setGoals(newGoals);
    localStorage.setItem('flousy_savings_goals', JSON.stringify(newGoals));
    if (user) {
      saveSavingsGoals(user.uid, newGoals).catch((e) => console.error(e));
    }
  };

  // Month navigation
  const handlePrevMonth = () => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setCurrentMonthKey(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setCurrentMonthKey(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  // Expense Handlers
  const handleSaveVariableExpense = (exp: VariableExpense) => {
    if (selectedExpense) {
      const updated = editVariableExpense(month, selectedExpense, exp);
      updateAndSaveMonth(updated);
    } else {
      const updated = addVariableExpense(month, exp);
      updateAndSaveMonth(updated);
    }
    setSelectedExpense(null);
  };

  const handleDeleteVariableExpense = (exp: VariableExpense) => {
    const updated = deleteVariableExpense(month, exp);
    updateAndSaveMonth(updated);
    setSelectedExpense(null);
  };

  // Fixed Bills Handlers
  const handleSaveFixedBill = (bill: FixedExpense) => {
    if (selectedFixed) {
      const updated = editFixedExpense(month, selectedFixed, bill);
      updateAndSaveMonth(updated);
    } else {
      const updated = addFixedExpense(month, bill);
      updateAndSaveMonth(updated);
    }
    setSelectedFixed(null);
  };

  const handleDeleteFixedBill = (bill: FixedExpense) => {
    const updated = deleteFixedExpense(month, bill);
    updateAndSaveMonth(updated);
    setSelectedFixed(null);
  };

  // Move Money Handler
  const handleMoveMoney = (from: MoneyPlace, to: MoneyPlace, amount: number) => {
    const updated = moveMoney(month, from, to, amount);
    updateAndSaveMonth(updated);
  };

  // Savings Handlers
  const handleSaveGoal = (goal: SavingGoal) => {
    const existingIdx = goals.findIndex((g) => g.id === goal.id);
    let nextGoals: SavingGoal[];
    if (existingIdx >= 0) {
      nextGoals = goals.map((g) => (g.id === goal.id ? goal : g));
    } else {
      nextGoals = [...goals, goal];
    }
    updateAndSaveGoals(nextGoals);
  };

  const handleFundGoal = (goalId: string, amount: number, sourcePlace: MoneyPlace) => {
    const res = fundGoal(month, goals, goalId, amount, sourcePlace);
    updateAndSaveMonth(res.month);
    updateAndSaveGoals(res.goals);
  };

  const handleWithdrawGoal = (goalId: string, amount: number, targetPlace: MoneyPlace) => {
    const res = withdrawGoal(month, goals, goalId, amount, targetPlace);
    updateAndSaveMonth(res.month);
    updateAndSaveGoals(res.goals);
  };

  const handleDeleteGoal = (goalId: string) => {
    const res = deleteFundedGoal(month, goals, goalId);
    updateAndSaveMonth(res.month);
    updateAndSaveGoals(res.goals);
  };

  // Categories Handlers
  const handleAddCategory = (name: string, color: string, icon: string) => {
    const nextCats = Array.from(new Set([...(month.activeCategories || []), name]));
    const nextColors = { ...(month.categoryColors || {}), [name]: color };
    const nextIcons = { ...(month.categoryIcons || {}), [name]: icon };

    const updated: MonthBudget = {
      ...month,
      activeCategories: nextCats,
      categoryColors: nextColors,
      categoryIcons: nextIcons,
    };
    updateAndSaveMonth(updated);
  };

  const handleRemoveCategory = (name: string) => {
    const nextCats = (month.activeCategories || []).filter((c) => c !== name);
    const updated: MonthBudget = {
      ...month,
      activeCategories: nextCats,
    };
    updateAndSaveMonth(updated);
  };

  // Debt Handlers
  const handleSaveDebt = (debt: DebtItem) => {
    const existingIdx = (month.debts || []).findIndex((d) => d.id === debt.id);
    let next: MonthBudget;
    if (existingIdx >= 0) {
      next = editDebt(month, debt.id, debt);
    } else {
      next = addDebt(month, debt);
    }
    updateAndSaveMonth(next);
  };

  const handleDeleteDebt = (debtId: string) => {
    const next = deleteDebt(month, debtId);
    updateAndSaveMonth(next);
  };

  // Income Sources Handler
  const handleSaveIncomeSources = (sources: any[], total: number) => {
    const updated = normalizeMonth({
      ...month,
      incomeSources: sources,
      totalBudget: total,
    });
    updateAndSaveMonth(updated);
  };

  // CSV Import Handlers
  const handleBatchImportVariable = (newExpenses: VariableExpense[]) => {
    let current = month;
    newExpenses.forEach((exp) => {
      current = addVariableExpense(current, exp);
    });
    updateAndSaveMonth(current);
  };

  const handleBatchImportFixed = (newBills: FixedExpense[]) => {
    let current = month;
    newBills.forEach((bill) => {
      current = addFixedExpense(current, bill);
    });
    updateAndSaveMonth(current);
  };

  const handleSendVerification = async () => {
    try {
      await sendVerificationEmail();
      setVerificationSent(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex font-sans">
      {/* Desktop Left Sidebar Navigation (Hidden on Mobile) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-surface-variant bg-surface shrink-0 fixed top-0 bottom-0 left-0 z-30">
        {/* Brand Logo */}
        <div className="p-5 flex items-center gap-3 border-b border-surface-variant/50">
          <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
          </div>
          <span className="font-headline-md text-headline-md font-extrabold text-primary tracking-tight">
            Flousy
          </span>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-label-lg transition-all ${
              activeTab === 'overview'
                ? 'bg-primary/10 text-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
            }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${activeTab === 'overview' ? 'filled' : ''}`}>
              grid_view
            </span>
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('fixed')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-label-lg transition-all ${
              activeTab === 'fixed'
                ? 'bg-primary/10 text-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
            }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${activeTab === 'fixed' ? 'filled' : ''}`}>
              event_repeat
            </span>
            <span>Fixed Bills</span>
          </button>

          <button
            onClick={() => setActiveTab('variable')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-label-lg transition-all ${
              activeTab === 'variable'
                ? 'bg-primary/10 text-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
            }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${activeTab === 'variable' ? 'filled' : ''}`}>
              receipt_long
            </span>
            <span>Variable Expenses</span>
          </button>

          <button
            onClick={() => setActiveTab('savings')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-label-lg transition-all ${
              activeTab === 'savings'
                ? 'bg-primary/10 text-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
            }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${activeTab === 'savings' ? 'filled' : ''}`}>
              savings
            </span>
            <span>Savings</span>
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-label-lg transition-all ${
              activeTab === 'trends'
                ? 'bg-primary/10 text-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
            }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${activeTab === 'trends' ? 'filled' : ''}`}>
              description
            </span>
            <span>Debts</span>
          </button>

          <div className="my-2 border-t border-surface-variant/40" />

          {/* Quick Tools */}
          <button
            onClick={() => setIsIncomeModalOpen(true)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl font-label-md text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">payments</span>
            <span>Income Sources</span>
          </button>

          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl font-label-md text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            <span>Import / Export CSV</span>
          </button>
        </nav>

        {/* Bottom Profile Footer */}
        <div className="p-4 border-t border-surface-variant/50 flex items-center justify-between bg-surface-container/20">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0">
              {profile?.displayName ? profile.displayName.charAt(0).toUpperCase() : user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="flex flex-col truncate">
              <span className="font-label-lg font-bold text-on-surface truncate">
                {profile?.displayName || (user?.email ? user.email.split('@')[0] : 'Amine Bennani')}
              </span>
              <span className="font-label-sm text-[10px] text-primary uppercase font-extrabold tracking-wider">
                {profile?.plan === 'pro' ? 'PRO PLAN' : 'FREE PLAN'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-xl transition-colors shrink-0"
            title="Settings"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        {/* Email Verification Banner */}
        {user && !user.emailVerified && !dismissVerificationBanner && (
          <div className="bg-tertiary-container text-on-tertiary-container px-margin-mobile py-2.5 flex items-center justify-between font-label-md text-label-md">
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-[20px]">mark_email_unread</span>
              <span>Please verify your email address to secure your account.</span>
              {verificationSent ? (
                <span className="font-bold underline ml-xs">Verification email sent!</span>
              ) : (
                <button
                  onClick={handleSendVerification}
                  className="font-bold underline ml-xs hover:opacity-80"
                >
                  Resend email
                </button>
              )}
            </div>
            <button
              onClick={() => setDismissVerificationBanner(true)}
              className="p-1 hover:bg-tertiary/20 rounded-full"
              aria-label="Dismiss banner"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Main Header Bar */}
        <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur-md border-b border-surface-variant px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Logo */}
            <div className="md:hidden flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[28px]">account_balance_wallet</span>
              <span className="font-headline-md text-headline-md text-primary font-extrabold tracking-tight">
                Flousy
              </span>
            </div>

            {/* Desktop Page Title */}
            <h1 className="hidden md:block font-headline-md text-headline-md font-extrabold text-on-surface capitalize">
              {activeTab === 'overview'
                ? 'Dashboard Overview'
                : activeTab === 'variable'
                ? 'Variable Expenses'
                : activeTab === 'fixed'
                ? 'Fixed Bills'
                : activeTab === 'savings'
                ? 'Savings Goals'
                : 'Debts'}
            </h1>
          </div>

          {/* Center Month Selector */}
          <div className="flex items-center gap-1 bg-surface-container px-3 py-1.5 rounded-2xl border border-outline-variant">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="font-label-lg text-label-lg font-bold text-on-surface min-w-[85px] text-center">
              {currentMonthKey}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
              aria-label="Next month"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-2">
            <BudgetAlerts month={month} />

            <button
              onClick={() => {
                setSelectedExpense(null);
                setIsExpenseModalOpen(true);
              }}
              className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md font-bold hover:bg-primary/90 shadow-xs transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>New Transaction</span>
            </button>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/60 rounded-xl transition-colors md:hidden"
              aria-label="Open Settings"
            >
              <span className="material-symbols-outlined text-[22px]">settings</span>
            </button>
          </div>
        </header>

        {/* Main Tab Content Workspace */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 pb-28 md:pb-12">
        {loading ? (
          <div className="flex flex-col gap-md py-xl">
            <div className="h-40 w-full skeleton-loader rounded-3xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
              <div className="h-32 w-full skeleton-loader rounded-2xl" />
              <div className="h-32 w-full skeleton-loader rounded-2xl" />
              <div className="h-32 w-full skeleton-loader rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                month={month}
                goals={goals}
                onOpenExpenseModal={() => {
                  setSelectedExpense(null);
                  setIsExpenseModalOpen(true);
                }}
                onOpenMoveMoneyModal={() => setIsMoveMoneyModalOpen(true)}
                onOpenEditExpense={(exp) => {
                  setSelectedExpense(exp);
                  setIsExpenseModalOpen(true);
                }}
                onSelectTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'variable' && (
              <VariableTab
                month={month}
                onOpenAddModal={() => {
                  setSelectedExpense(null);
                  setIsExpenseModalOpen(true);
                }}
                onEditExpense={(exp) => {
                  setSelectedExpense(exp);
                  setIsExpenseModalOpen(true);
                }}
                onManageCategories={() => setIsManageCategoriesOpen(true)}
              />
            )}

            {activeTab === 'fixed' && (
              <FixedTab
                month={month}
                onOpenAddModal={() => {
                  setSelectedFixed(null);
                  setIsFixedModalOpen(true);
                }}
                onEditBill={(bill) => {
                  setSelectedFixed(bill);
                  setIsFixedModalOpen(true);
                }}
              />
            )}

            {activeTab === 'savings' && (
              <SavingsTab
                goals={goals}
                onOpenCreateGoal={() => {
                  setSelectedGoal(null);
                  setSavingsModalMode('create');
                  setIsSavingsModalOpen(true);
                }}
                onOpenFundModal={(g) => {
                  setSelectedGoal(g);
                  setSavingsModalMode('fund');
                  setIsSavingsModalOpen(true);
                }}
                onOpenWithdrawModal={(g) => {
                  setSelectedGoal(g);
                  setSavingsModalMode('withdraw');
                  setIsSavingsModalOpen(true);
                }}
                onOpenEditGoal={(g) => {
                  setSelectedGoal(g);
                  setSavingsModalMode('edit');
                  setIsSavingsModalOpen(true);
                }}
              />
            )}

            {activeTab === 'trends' && (
              <DebtsTab
                month={month}
                onOpenDebtModal={() => {
                  setSelectedDebt(null);
                  setIsDebtModalOpen(true);
                }}
              />
            )}
          </>
        )}
      </main>
      </div>

      {/* Primary Floating Action Button (FAB for Mobile) */}
      {activeTab !== 'trends' && (
        <button
          onClick={() => {
            setSelectedExpense(null);
            setIsExpenseModalOpen(true);
          }}
          className="md:hidden fixed bottom-22 right-5 z-40 w-14 h-14 bg-primary text-on-primary rounded-2xl shadow-[0_8px_24px_rgba(0,104,95,0.35)] flex items-center justify-center hover:bg-primary-container active:scale-95 transition-all"
          aria-label="Add Expense"
        >
          <span className="material-symbols-outlined text-[30px]">add</span>
        </button>
      )}

      {/* Floating Glass Bottom Navigation Bar (Mobile Only - Without Labels) */}
      <nav className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md bg-surface/70 backdrop-blur-2xl border border-surface-variant/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full px-2 py-1.5 flex justify-around items-center">
        <button
          onClick={() => setActiveTab('overview')}
          className={`relative p-3 rounded-full flex items-center justify-center transition-all duration-200 ${
            activeTab === 'overview'
              ? 'bg-primary text-on-primary shadow-sm scale-105'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'
          }`}
          aria-label="Overview"
          title="Overview"
        >
          <span className={`material-symbols-outlined text-[24px] ${activeTab === 'overview' ? 'filled' : ''}`}>
            grid_view
          </span>
        </button>

        <button
          onClick={() => setActiveTab('fixed')}
          className={`relative p-3 rounded-full flex items-center justify-center transition-all duration-200 ${
            activeTab === 'fixed'
              ? 'bg-primary text-on-primary shadow-sm scale-105'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'
          }`}
          aria-label="Fixed Bills"
          title="Fixed Bills"
        >
          <span className={`material-symbols-outlined text-[24px] ${activeTab === 'fixed' ? 'filled' : ''}`}>
            receipt_long
          </span>
        </button>

        <button
          onClick={() => setActiveTab('variable')}
          className={`relative p-3 rounded-full flex items-center justify-center transition-all duration-200 ${
            activeTab === 'variable'
              ? 'bg-primary text-on-primary shadow-sm scale-105'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'
          }`}
          aria-label="Variable Expenses"
          title="Variable Expenses"
        >
          <span className={`material-symbols-outlined text-[24px] ${activeTab === 'variable' ? 'filled' : ''}`}>
            payments
          </span>
        </button>

        <button
          onClick={() => setActiveTab('savings')}
          className={`relative p-3 rounded-full flex items-center justify-center transition-all duration-200 ${
            activeTab === 'savings'
              ? 'bg-primary text-on-primary shadow-sm scale-105'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'
          }`}
          aria-label="Savings Goals"
          title="Savings Goals"
        >
          <span className={`material-symbols-outlined text-[24px] ${activeTab === 'savings' ? 'filled' : ''}`}>
            savings
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trends')}
          className={`relative p-3 rounded-full flex items-center justify-center transition-all duration-200 ${
            activeTab === 'trends'
              ? 'bg-primary text-on-primary shadow-sm scale-105'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'
          }`}
          aria-label="Debts"
          title="Debts"
        >
          <span className={`material-symbols-outlined text-[24px] ${activeTab === 'trends' ? 'filled' : ''}`}>
            description
          </span>
        </button>
      </nav>

      {/* Modals */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setSelectedExpense(null);
        }}
        onSave={handleSaveVariableExpense}
        onDelete={handleDeleteVariableExpense}
        initialExpense={selectedExpense}
        categories={month.activeCategories || []}
        categoryColors={month.categoryColors}
        categoryIcons={month.categoryIcons}
      />

      <MoveMoneyModal
        isOpen={isMoveMoneyModalOpen}
        onClose={() => setIsMoveMoneyModalOpen(false)}
        onMove={handleMoveMoney}
        month={month}
      />

      <FixedModal
        isOpen={isFixedModalOpen}
        onClose={() => {
          setIsFixedModalOpen(false);
          setSelectedFixed(null);
        }}
        onSave={handleSaveFixedBill}
        onDelete={handleDeleteFixedBill}
        initialBill={selectedFixed}
        categories={month.activeCategories || []}
      />

      <SavingsModal
        isOpen={isSavingsModalOpen}
        onClose={() => {
          setIsSavingsModalOpen(false);
          setSelectedGoal(null);
        }}
        mode={savingsModalMode}
        goal={selectedGoal}
        onSaveGoal={handleSaveGoal}
        onFund={handleFundGoal}
        onWithdraw={handleWithdrawGoal}
        onDelete={handleDeleteGoal}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        month={month}
        goals={goals}
        monthKey={currentMonthKey}
        onOpenProModal={() => {
          setIsSettingsModalOpen(false);
          setIsProModalOpen(true);
        }}
      />

      <ManageCategoriesModal
        isOpen={isManageCategoriesOpen}
        onClose={() => setIsManageCategoriesOpen(false)}
        categories={month.activeCategories || []}
        categoryColors={month.categoryColors || {}}
        categoryIcons={month.categoryIcons || {}}
        onAddCategory={handleAddCategory}
        onRemoveCategory={handleRemoveCategory}
      />

      <ProUpgradeModal
        isOpen={isProModalOpen}
        onClose={() => setIsProModalOpen(false)}
      />

      <ImportCsvModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        month={month}
        onImportVariable={handleBatchImportVariable}
        onImportFixed={handleBatchImportFixed}
      />

      <IncomeSourcesModal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        month={month}
        onSaveIncomeSources={handleSaveIncomeSources}
      />

      <DebtModal
        isOpen={isDebtModalOpen}
        onClose={() => {
          setIsDebtModalOpen(false);
          setSelectedDebt(null);
        }}
        onSave={handleSaveDebt}
        onDelete={handleDeleteDebt}
        initialDebt={selectedDebt}
      />
    </div>
  );
}
