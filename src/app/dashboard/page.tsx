'use client';

import { AppIcon } from '@/components/ui/app-icon';

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
  calculateEnvelopeAmounts,
  addVariableExpense,
  editVariableExpense,
  deleteVariableExpense,
  addFixedExpense,
  editFixedExpense,
  deleteFixedExpense,
  moveMoney,
  updateMoneyPlaces,
  updateBudgetStrategy,
  fundGoal,
  withdrawGoal,
  deleteFundedGoal,
  DebtItem,
  addDebt,
  editDebt,
  deleteDebt,
  carryOverFixedExpenses,
  StrategyId,
} from '../../lib/store';
import {
  subscribeMonthBudget,
  saveMonthBudget,
  subscribeSavingsGoals,
  saveSavingsGoals,
  fetchMonthsForTrends,
  getMonthBudget,
  listMonths,
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
import { EditMoneyPlacesModal } from '../../components/modals/EditMoneyPlacesModal';
import { BudgetAlerts } from '../../components/ui/BudgetAlerts';
import { InstallButton } from '../../components/pwa/install-button';
import { isProUser } from '../../lib/pro-features';
import { getMobileQuickActions } from '../../lib/dashboard-quick-actions';
import { trackEvent } from '../../lib/analytics';

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, sendVerificationEmail, dismissVerificationBanner, setDismissVerificationBanner, loading: authLoading } = useAuth();
  const { format } = useCurrency();

  // Active Month Key (YYYY-MM)
  const today = new Date();
  const defaultMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(defaultMonthKey);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'variable' | 'fixed' | 'savings' | 'trends' | 'debts'>('overview');

  // Core State
  const [month, setMonth] = useState<MonthBudget>(() => normalizeMonth({ totalBudget: 0 }));
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Multi-month trends data
  const [trendsMonths, setTrendsMonths] = useState<{ monthKey: string; month: MonthBudget }[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Auth Protection Effect
  useEffect(() => {
    if (authLoading) return;

    const isDemo =
      typeof window !== 'undefined' &&
      localStorage.getItem('flousy_demo_mode') === 'true';

    if (!user && !isDemo) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isPro = isProUser(profile);

  useEffect(() => {
    if (!isPro && activeTab === 'trends') {
      setActiveTab('overview');
    }
  }, [activeTab, isPro]);

  // Modal Open States
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<VariableExpense | null>(null);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

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
  const [isEditMoneyPlacesOpen, setIsEditMoneyPlacesOpen] = useState(false);
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

  // Carry over recurring fixed expenses from previous month
  const carryOverRecurring = async (monthKey: string) => {
    const [y, m] = monthKey.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    if (user) {
      const prev = await getMonthBudget(user.uid, prevKey);
      if (prev) {
        const withCarry = carryOverFixedExpenses(month, prev);
        if (withCarry.fixedExpenses.length > month.fixedExpenses.length) {
          updateAndSaveMonth(withCarry);
        }
      }
    } else {
      try {
        const local = localStorage.getItem(`flousy_month_${prevKey}`);
        if (local) {
          const prev = normalizeMonth(JSON.parse(local), prevKey);
          const withCarry = carryOverFixedExpenses(month, prev);
          if (withCarry.fixedExpenses.length > month.fixedExpenses.length) {
            updateAndSaveMonth(withCarry);
          }
        }
      } catch { /* ignore */ }
    }
  };

  // Automatically carry over recurring bills when entering a fresh month
  useEffect(() => {
    if (!loading && month && month.totalBudget > 0 &&
        (month.variableExpenses || []).length === 0 &&
        (month.fixedExpenses || []).length === 0) {
      carryOverRecurring(currentMonthKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthKey, loading]);

  // Load multi-month data when Trends tab is active
  useEffect(() => {
    if (activeTab === 'trends' && month.totalBudget > 0) {
      setTrendsLoading(true);
      fetchMonthsForTrends(user?.uid, currentMonthKey, 6)
        .then((data) => setTrendsMonths(data))
        .catch(() => {})
        .finally(() => setTrendsLoading(false));
    }
  }, [activeTab, currentMonthKey, user?.uid, month.totalBudget]);

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
      trackEvent('edit_variable_expense', { category: exp.type, amount: exp.amount });
    } else {
      const updated = addVariableExpense(month, exp);
      updateAndSaveMonth(updated);
      trackEvent('add_variable_expense', { category: exp.type, amount: exp.amount });
    }
    setSelectedExpense(null);
  };

  const handleDeleteVariableExpense = (exp: VariableExpense) => {
    const updated = deleteVariableExpense(month, exp);
    updateAndSaveMonth(updated);
    trackEvent('delete_variable_expense', { category: exp.type });
    setSelectedExpense(null);
  };

  // Fixed Bills Handlers
  const handleSaveFixedBill = (bill: FixedExpense) => {
    if (selectedFixed) {
      const updated = editFixedExpense(month, selectedFixed, bill);
      updateAndSaveMonth(updated);
      trackEvent('edit_fixed_expense', { category: bill.type, amount: bill.amount });
    } else {
      const updated = addFixedExpense(month, bill);
      updateAndSaveMonth(updated);
      trackEvent('add_fixed_expense', { category: bill.type, amount: bill.amount });
    }
    setSelectedFixed(null);
  };

  const handleDeleteFixedBill = (bill: FixedExpense) => {
    const updated = deleteFixedExpense(month, bill);
    updateAndSaveMonth(updated);
    trackEvent('delete_fixed_expense', { category: bill.type });
    setSelectedFixed(null);
  };

  // Move Money Handler
  const handleMoveMoney = (from: MoneyPlace, to: MoneyPlace, amount: number) => {
    const updated = moveMoney(month, from, to, amount);
    updateAndSaveMonth(updated);
    trackEvent('move_money', { from, to, amount });
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
    trackEvent('fund_goal', { amount, sourcePlace });
  };

  const handleWithdrawGoal = (goalId: string, amount: number, targetPlace: MoneyPlace) => {
    const res = withdrawGoal(month, goals, goalId, amount, targetPlace);
    updateAndSaveMonth(res.month);
    updateAndSaveGoals(res.goals);
    trackEvent('withdraw_goal', { amount, targetPlace });
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
  // TOTAL MONTHLY BUDGET = Bank + Wallet + Home
  // Income goes first to Bank, then can be moved to Wallet/Home via Move Money
  const handleSaveIncomeSources = (sources: any[], total: number) => {
    const oldTotal = month.totalBudget || 0;
    const difference = total - oldTotal;
    // New income goes first to Bank; if total is reduced, deduct from Bank
    const newBankPart = Math.max(0, (month.bankPart || 0) + difference);

    const updated = normalizeMonth({
      ...month,
      incomeSources: sources,
      totalBudget: total,
      bankPart: newBankPart,
    });
    updateAndSaveMonth(updated);
  };

  const handleUpdateTotalBudget = (newTotalBudget: number) => {
    const safeBudget = Math.max(0, Number.isFinite(newTotalBudget) ? newTotalBudget : month.totalBudget || 0);
    const delta = safeBudget - (month.totalBudget || 0);

    const updated = normalizeMonth({
      ...month,
      totalBudget: safeBudget,
      bankPart: Math.max(0, (month.bankPart || 0) + delta),
      monthlySavingsTarget: calculateEnvelopeAmounts(safeBudget, month.strategyId).savings,
    }, currentMonthKey);

    updateAndSaveMonth(updated);
    trackEvent('update_total_budget', { amount: safeBudget });
  };

  // Editing cash balances must NOT change the monthly budget (budget = income plan,
  // balances = current cash on hand). updateMoneyPlaces enforces that invariant.
  const handleEditMoneyPlaces = (values: { bank: number; home: number; wallet: number }) => {
    const updated = updateMoneyPlaces(month, values);
    updateAndSaveMonth(updated);
  };

  // Strategy change handler: update the strategy and recalculate envelope amounts
  const handleUpdateStrategy = (strategyId: StrategyId) => {
    const updated = updateBudgetStrategy(month, strategyId);
    updateAndSaveMonth(updated);
    trackEvent('change_strategy', { strategyId });
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
            <AppIcon name="account_balance_wallet" className=" text-[24px]" />
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
            <AppIcon name="grid_view" className={` text-[22px] ${activeTab === 'overview' ? 'filled' : ''}`} />
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
            <AppIcon name="event_repeat" className={` text-[22px] ${activeTab === 'fixed' ? 'filled' : ''}`} />
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
            <AppIcon name="receipt_long" className={` text-[22px] ${activeTab === 'variable' ? 'filled' : ''}`} />
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
            <AppIcon name="savings" className={` text-[22px] ${activeTab === 'savings' ? 'filled' : ''}`} />
            <span>Savings</span>
          </button>

          {isPro && (
            <button
              onClick={() => setActiveTab('trends')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-label-lg transition-all ${
                activeTab === 'trends'
                  ? 'bg-primary/10 text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
              }`}
            >
              <AppIcon name="trending_up" className={` text-[22px] ${activeTab === 'trends' ? 'filled' : ''}`} />
              <span>Trends</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('debts')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-label-lg transition-all ${
              activeTab === 'debts'
                ? 'bg-primary/10 text-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
            }`}
          >
            <AppIcon name="description" className={` text-[22px] ${activeTab === 'debts' ? 'filled' : ''}`} />
            <span>Debts</span>
          </button>

          <div className="my-2 border-t border-surface-variant/40" />

          {/* Quick Tools */}
          <button
            onClick={() => {
              if (!isPro) {
                setIsProModalOpen(true);
                return;
              }
              setIsIncomeModalOpen(true);
            }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface transition-all"
          >
            <AppIcon name="payments" className=" text-[20px]" />
            <span>Income Sources</span>
          </button>

          <button
            onClick={() => {
              if (!isPro) {
                setIsProModalOpen(true);
                return;
              }
              setIsCsvModalOpen(true);
            }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface transition-all"
          >
            <AppIcon name="upload_file" className=" text-[20px]" />
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
            <AppIcon name="settings" className=" text-[20px]" />
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        {/* Email Verification Banner */}
        {user && !user.emailVerified && !dismissVerificationBanner && (
          <div className="bg-tertiary-container text-on-tertiary-container px-margin-mobile py-2.5 flex items-center justify-between font-label-md text-label-md">
            <div className="flex items-center gap-xs">
              <AppIcon name="mark_email_unread" className=" text-[20px]" />
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
              <AppIcon name="close" className=" text-[18px]" />
            </button>
          </div>
        )}

        {/* Main Header Bar */}
        <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur-md border-b border-surface-variant px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex self-center gap-3 ">
            {/* Mobile Logo + Balance */}
            <div className="md:hidden flex flex-col">
              <div className="flex items-center gap-2">
                <AppIcon name="account_balance_wallet" className=" text-primary text-[24px]" />
                <span className="font-headline-sm text-headline-sm text-primary font-extrabold tracking-tight">
                  Flousy
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant font-medium">
                Total Balance: {isMounted ? format((month.bankPart || 0) + (month.homePart || 0) + (month.walletPart || 0)) : '0.00 MAD'}
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
                : activeTab === 'trends'
                ? 'Trends & Analytics'
                : 'Debts & Credits'}
            </h1>
          </div>

          {/* Center Month Selector */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-surface-container px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-outline-variant">
            <button
              onClick={handlePrevMonth}
              className="p-0.5 sm:p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <AppIcon name="chevron_left" className=" text-[16px] sm:text-[18px]" />
            </button>
            <span className="font-label-sm sm:font-label-lg text-label-sm sm:text-label-lg font-bold text-on-surface min-w-[32px] sm:min-w-[64px] text-center uppercase">
              {(() => {
                const [y, m] = currentMonthKey.split('-').map(Number);
                const d = new Date(y, m - 1, 1);
                return d.toLocaleDateString('en-US', { month: 'short' });
              })()}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-0.5 sm:p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
              aria-label="Next month"
            >
              <AppIcon name="chevron_right" className=" text-[16px] sm:text-[18px]" />
            </button>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-2">
            <InstallButton compact />

            <BudgetAlerts month={month} />

            <button
              onClick={() => {
                setSelectedExpense(null);
                setIsExpenseModalOpen(true);
              }}
              className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-full font-label-md font-bold hover:bg-accent-foreground shadow-xs transition-all"
            >
              <AppIcon name="add" className=" text-[18px]" />
              <span>New Transaction</span>
            </button>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/60 rounded-xl transition-colors md:hidden"
              aria-label="Open Settings"
            >
              <AppIcon name="settings" className=" text-[22px]" />
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
                onUpdateTotalBudget={handleUpdateTotalBudget}
                onEditMoneyPlaces={() => setIsEditMoneyPlacesOpen(true)}
                onUpdateStrategy={handleUpdateStrategy}
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
              <TrendsTab
                month={month}
                trendsMonths={trendsMonths}
                trendsLoading={trendsLoading}
                profile={profile}
                onOpenProModal={() => setIsProModalOpen(true)}
              />
            )}

            {activeTab === 'debts' && (
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

      {/* Mobile quick actions overlay */}
      {activeTab !== 'trends' && activeTab !== 'debts' && (
        <>
          {isQuickActionsOpen && (
            <button
              type="button"
              aria-label="Close quick actions"
              className="md:hidden fixed inset-0 z-30 bg-transparent"
              onClick={() => setIsQuickActionsOpen(false)}
            />
          )}

          <div
            className={`md:hidden fixed bottom-38 right-5 z-40 flex flex-col items-end gap-2 transition-all duration-300 ease-out ${
              isQuickActionsOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-3 opacity-0 pointer-events-none'
            }`}
          >
            {getMobileQuickActions().map((action, index) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  setIsQuickActionsOpen(false);

                  if (action.id === 'expense') {
                    setSelectedExpense(null);
                    setIsExpenseModalOpen(true);
                  } else if (action.id === 'charge') {
                    setSelectedFixed(null);
                    setIsFixedModalOpen(true);
                  } else if (action.id === 'savings') {
                    setSelectedGoal(null);
                    setSavingsModalMode('create');
                    setIsSavingsModalOpen(true);
                  }
                }}
                className="flex items-center gap-2 rounded-full bg-surface/95 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)] border border-outline-variant backdrop-blur-xl transition-all duration-300"
                style={{ transitionDelay: `${index * 70}ms` }}
                aria-label={action.label}
              >
                <span className="font-label-md text-label-md text-on-surface whitespace-nowrap">{action.label}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary">
                  <AppIcon name={action.icon} className="text-[18px]" />
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsQuickActionsOpen((prev) => !prev)}
            className="md:hidden fixed bottom-22 right-5 z-40 h-14 w-14 bg-primary text-on-primary rounded-2xl shadow-[0_8px_24px_rgba(0,104,95,0.35)] flex items-center justify-center hover:bg-accent-foreground active:scale-95 transition-all"
            aria-label={isQuickActionsOpen ? 'Close quick actions' : 'Open quick actions'}
          >
            <AppIcon name={isQuickActionsOpen ? 'close' : 'add'} className={`text-[30px] transition-transform duration-300 ${isQuickActionsOpen ? 'rotate-45' : 'rotate-0'}`} />
          </button>
        </>
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
          <AppIcon name="grid_view" className={` text-[24px] ${activeTab === 'overview' ? 'filled' : ''}`} />
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
          <AppIcon name="receipt_long" className={` text-[24px] ${activeTab === 'fixed' ? 'filled' : ''}`} />
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
          <AppIcon name="payments" className={` text-[24px] ${activeTab === 'variable' ? 'filled' : ''}`} />
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
          <AppIcon name="savings" className={` text-[24px] ${activeTab === 'savings' ? 'filled' : ''}`} />
        </button>

        {isPro && (
          <button
            onClick={() => setActiveTab('trends')}
            className={`relative p-3 rounded-full flex items-center justify-center transition-all duration-200 ${
              activeTab === 'trends'
                ? 'bg-primary text-on-primary shadow-sm scale-105'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'
            }`}
            aria-label="Trends"
            title="Trends"
          >
            <AppIcon name="trending_up" className={` text-[24px] ${activeTab === 'trends' ? 'filled' : ''}`} />
          </button>
        )}

        <button
          onClick={() => setActiveTab('debts')}
          className={`relative p-3 rounded-full flex items-center justify-center transition-all duration-200 ${
            activeTab === 'debts'
              ? 'bg-primary text-on-primary shadow-sm scale-105'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'
          }`}
          aria-label="Debts"
          title="Debts"
        >
          <AppIcon name="description" className={` text-[24px] ${activeTab === 'debts' ? 'filled' : ''}`} />
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

      <EditMoneyPlacesModal
        isOpen={isEditMoneyPlacesOpen}
        onClose={() => setIsEditMoneyPlacesOpen(false)}
        initialValues={{ bank: month.bankPart || 0, home: month.homePart || 0, wallet: month.walletPart || 0 }}
        totalBudget={month.totalBudget || 0}
        onSave={(values) => {
          handleEditMoneyPlaces(values);
          setIsEditMoneyPlacesOpen(false);
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
