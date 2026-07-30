'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import {
  MonthBudget,
  SavingGoal,
  VariableExpense,
  FixedExpense,
  DebtItem,
  StrategyId,
  CustomRatios,
  UserProfile,
  normalizeMonth,
  calculateEnvelopeAmounts,
  addVariableExpense,
  addFixedExpense,
  updateMoneyPlaces,
  updateBudgetStrategy,
  carryOverFixedExpenses,
} from '../../lib/store';
import {
  subscribeMonthBudget,
  saveMonthBudget,
  subscribeSavingsGoals,
  saveSavingsGoals,
  fetchMonthsForTrends,
  getMonthBudget,
} from '../../lib/db';
import { isProUser } from '../../lib/pro-features';
import { trackEvent } from '../../lib/analytics';
import { getScreenIdFromPath } from './nav-items';

export type SavingsModalMode = 'create' | 'fund' | 'withdraw' | 'edit';

interface DashboardContextType {
  // Auth / plan
  user: ReturnType<typeof useAuth>['user'];
  profile: UserProfile | null;
  authLoading: boolean;
  isPro: boolean;

  // Email verification banner
  verificationSent: boolean;
  sendVerification: () => void;
  dismissVerificationBanner: boolean;
  setDismissVerificationBanner: (val: boolean) => void;

  // Active month
  currentMonthKey: string;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;

  // Core data
  month: MonthBudget;
  goals: SavingGoal[];
  loading: boolean;
  isMounted: boolean;

  // Multi-month trends
  trendsMonths: { monthKey: string; month: MonthBudget }[];
  trendsLoading: boolean;

  // Persistence helpers
  updateAndSaveMonth: (month: MonthBudget) => void;
  updateAndSaveGoals: (goals: SavingGoal[]) => void;

  // Budget handlers
  handleUpdateTotalBudget: (newTotalBudget: number) => void;
  handleEditMoneyPlaces: (values: { bank: number; home: number; wallet: number }) => void;
  handleUpdateStrategy: (strategyId: StrategyId, customRatios?: CustomRatios) => void;
  handleUpdateProfile: (updatedProfile: UserProfile) => Promise<void>;
  handleSaveIncomeSources: (sources: any[], total: number) => void;

  // Category handlers
  handleAddCategory: (name: string, color: string, icon: string) => void;
  handleRemoveCategory: (name: string) => void;

  // CSV import handlers
  handleBatchImportVariable: (newExpenses: VariableExpense[]) => void;
  handleBatchImportFixed: (newBills: FixedExpense[]) => void;

  // Modals
  openExpenseModal: (expense?: VariableExpense | null) => void;
  closeExpenseModal: () => void;
  isExpenseModalOpen: boolean;
  selectedExpense: VariableExpense | null;

  openFixedModal: (bill?: FixedExpense | null) => void;
  closeFixedModal: () => void;
  isFixedModalOpen: boolean;
  selectedFixed: FixedExpense | null;

  openMoveMoneyModal: () => void;
  closeMoveMoneyModal: () => void;
  isMoveMoneyModalOpen: boolean;

  openSavingsModal: (mode: SavingsModalMode, goal?: SavingGoal | null) => void;
  closeSavingsModal: () => void;
  isSavingsModalOpen: boolean;
  savingsModalMode: SavingsModalMode;
  selectedGoal: SavingGoal | null;

  openManageCategories: () => void;
  closeManageCategories: () => void;
  isManageCategoriesOpen: boolean;

  openProModal: () => void;
  closeProModal: () => void;
  isProModalOpen: boolean;

  openCsvModal: () => void;
  closeCsvModal: () => void;
  isCsvModalOpen: boolean;

  openIncomeModal: () => void;
  closeIncomeModal: () => void;
  isIncomeModalOpen: boolean;

  openEditMoneyPlaces: () => void;
  closeEditMoneyPlaces: () => void;
  isEditMoneyPlacesOpen: boolean;

  openDebtModal: (debt?: DebtItem | null) => void;
  closeDebtModal: () => void;
  isDebtModalOpen: boolean;
  selectedDebt: DebtItem | null;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    profile,
    sendVerificationEmail,
    dismissVerificationBanner,
    setDismissVerificationBanner,
    loading: authLoading,
    updateProfileData,
  } = useAuth();

  // Active Month Key (YYYY-MM)
  const today = new Date();
  const defaultMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(defaultMonthKey);

  // Core State
  const [month, setMonth] = useState<MonthBudget>(() =>
    normalizeMonth({ totalBudget: 0 }, undefined, profile),
  );
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Multi-month trends data
  const [trendsMonths, setTrendsMonths] = useState<{ monthKey: string; month: MonthBudget }[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const isPro = isProUser(profile);

  // Auth + Onboarding Protection Effect
  useEffect(() => {
    if (authLoading) return;

    const isDemo =
      typeof window !== 'undefined' && localStorage.getItem('flousy_demo_mode') === 'true';

    if (!user && !isDemo) {
      router.push('/login');
      return;
    }

    // Onboarding must always be the first screen after signup — keep
    // bouncing back to it until it has been completed.
    // Local fallbacks: the flag written by the onboarding page and any
    // previously saved budget data (covers the Firebase-save timeout path
    // and pre-existing demo data).
    const onboardingDoneLocally =
      typeof window !== 'undefined' &&
      (localStorage.getItem('flousy_onboarding_done') === 'true' ||
        !!localStorage.getItem(`flousy_month_${defaultMonthKey}`));

    if (isDemo) {
      if (!onboardingDoneLocally) {
        router.replace('/onboarding');
      }
      return;
    }

    if (user && profile && profile.onboardingComplete === false) {
      if (!onboardingDoneLocally) {
        router.replace('/onboarding');
      } else {
        // Self-heal: onboarding was finished on this device but the flag
        // never made it to the cloud profile.
        updateProfileData({ onboardingComplete: true }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading, router, defaultMonthKey, updateProfileData]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Modal Open States
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<VariableExpense | null>(null);

  const [isMoveMoneyModalOpen, setIsMoveMoneyModalOpen] = useState(false);

  const [isFixedModalOpen, setIsFixedModalOpen] = useState(false);
  const [selectedFixed, setSelectedFixed] = useState<FixedExpense | null>(null);

  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [savingsModalMode, setSavingsModalMode] = useState<SavingsModalMode>('create');
  const [selectedGoal, setSelectedGoal] = useState<SavingGoal | null>(null);

  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isEditMoneyPlacesOpen, setIsEditMoneyPlacesOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtItem | null>(null);

  const [verificationSent, setVerificationSent] = useState(false);

  // Helper to get previous month data for rollover
  const getPreviousMonth = useCallback(
    async (monthKey: string): Promise<MonthBudget | undefined> => {
      const [y, m] = monthKey.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      if (user) {
        const prev = await getMonthBudget(user.uid, prevKey);
        return prev || undefined;
      } else {
        try {
          const local = localStorage.getItem(`flousy_month_${prevKey}`);
          if (local) {
            return normalizeMonth(JSON.parse(local), prevKey, profile);
          }
        } catch {
          /* ignore */
        }
      }
      return undefined;
    },
    [user, profile],
  );

  // 1. Subscribe or load month budget
  useEffect(() => {
    setLoading(true);

    if (user) {
      const unsub = subscribeMonthBudget(user.uid, currentMonthKey, async (data) => {
        if (data) {
          setMonth(data);
        } else {
          // Fetch previous month for rollover
          const previousMonth = await getPreviousMonth(currentMonthKey);

          // If no month document exists in Firestore, check local storage or initialize clean default
          const local = localStorage.getItem(`flousy_month_${currentMonthKey}`);
          if (local) {
            try {
              setMonth(normalizeMonth(JSON.parse(local), currentMonthKey, profile, previousMonth));
            } catch {
              setMonth(normalizeMonth({ totalBudget: 0 }, currentMonthKey, profile, previousMonth));
            }
          } else {
            const clean = normalizeMonth({ totalBudget: 0 }, currentMonthKey, profile, previousMonth);
            setMonth(clean);
          }
        }
        setLoading(false);
      });
      return () => unsub();
    } else {
      getPreviousMonth(currentMonthKey).then((previousMonth) => {
        setMonth(normalizeMonth({ totalBudget: 0 }, currentMonthKey, profile, previousMonth));
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentMonthKey, profile]);

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
  const updateAndSaveMonth = useCallback(
    (newMonth: MonthBudget) => {
      setMonth(newMonth);
      localStorage.setItem(`flousy_month_${currentMonthKey}`, JSON.stringify(newMonth));
      if (user) {
        saveMonthBudget(user.uid, currentMonthKey, newMonth).catch((e) => console.error(e));
      }
    },
    [currentMonthKey, user],
  );

  // Helper to persist goals updates locally + cloud
  const updateAndSaveGoals = useCallback(
    (newGoals: SavingGoal[]) => {
      setGoals(newGoals);
      localStorage.setItem('flousy_savings_goals', JSON.stringify(newGoals));
      if (user) {
        saveSavingsGoals(user.uid, newGoals).catch((e) => console.error(e));
      }
    },
    [user],
  );

  // Carry over recurring fixed expenses from previous month
  const carryOverRecurring = useCallback(
    async (monthKey: string) => {
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
            const prev = normalizeMonth(JSON.parse(local), prevKey, profile);
            const withCarry = carryOverFixedExpenses(month, prev);
            if (withCarry.fixedExpenses.length > month.fixedExpenses.length) {
              updateAndSaveMonth(withCarry);
            }
          }
        } catch {
          /* ignore */
        }
      }
    },
    [month, profile, updateAndSaveMonth, user],
  );

  // Automatically carry over recurring bills when entering a fresh month
  useEffect(() => {
    if (
      !loading &&
      month &&
      month.totalBudget > 0 &&
      (month.variableExpenses || []).length === 0 &&
      (month.fixedExpenses || []).length === 0
    ) {
      carryOverRecurring(currentMonthKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthKey, loading]);

  // Load multi-month data when the Trends screen is active
  const onTrendsScreen = getScreenIdFromPath(pathname) === 'trends';
  useEffect(() => {
    if (onTrendsScreen && month.totalBudget > 0) {
      setTrendsLoading(true);
      fetchMonthsForTrends(user?.uid, currentMonthKey, 6)
        .then((data) => setTrendsMonths(data))
        .catch(() => {})
        .finally(() => setTrendsLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTrendsScreen, currentMonthKey, user?.uid, month.totalBudget]);

  // Month navigation
  const handlePrevMonth = useCallback(() => {
    setCurrentMonthKey((prevKey) => {
      const [y, m] = prevKey.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonthKey((prevKey) => {
      const [y, m] = prevKey.split('-').map(Number);
      const nextDate = new Date(y, m, 1);
      return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    });
  }, []);

  // Budget handlers
  const handleUpdateTotalBudget = useCallback(
    (newTotalBudget: number) => {
      const safeBudget = Math.max(
        0,
        Number.isFinite(newTotalBudget) ? newTotalBudget : month.totalBudget || 0,
      );
      const delta = safeBudget - (month.totalBudget || 0);

      const updated = normalizeMonth(
        {
          ...month,
          totalBudget: safeBudget,
          bankPart: Math.max(0, (month.bankPart || 0) + delta),
          monthlySavingsTarget: calculateEnvelopeAmounts(
            safeBudget,
            month.strategyId,
            month.customRatios,
          ).savings,
        },
        currentMonthKey,
        profile,
      );

      updateAndSaveMonth(updated);
      trackEvent('update_total_budget', { amount: safeBudget });
    },
    [month, currentMonthKey, profile, updateAndSaveMonth],
  );

  const handleEditMoneyPlaces = useCallback(
    (values: { bank: number; home: number; wallet: number }) => {
      const updated = updateMoneyPlaces(month, values);
      updateAndSaveMonth(updated);
    },
    [month, updateAndSaveMonth],
  );

  const handleUpdateStrategy = useCallback(
    (strategyId: StrategyId, customRatios?: CustomRatios) => {
      const updated = updateBudgetStrategy(month, strategyId, customRatios);
      updateAndSaveMonth(updated);
      trackEvent('change_strategy', {
        strategyId,
        ...(strategyId === 'custom' && updated.customRatios
          ? {
              needsPct: Math.round(updated.customRatios.needs * 100),
              wantsPct: Math.round(updated.customRatios.wants * 100),
              savingsPct: Math.round(updated.customRatios.savings * 100),
            }
          : {}),
      });
    },
    [month, updateAndSaveMonth],
  );

  const handleUpdateProfile = useCallback(
    async (updatedProfile: UserProfile) => {
      await updateProfileData(updatedProfile);
    },
    [updateProfileData],
  );

  // TOTAL MONTHLY BUDGET = Bank + Wallet + Home
  // Income goes first to Bank, then can be moved to Wallet/Home via Move Money
  const handleSaveIncomeSources = useCallback(
    (sources: any[], total: number) => {
      const oldTotal = month.totalBudget || 0;
      const difference = total - oldTotal;
      // New income goes first to Bank; if total is reduced, deduct from Bank
      const newBankPart = Math.max(0, (month.bankPart || 0) + difference);

      const updated = normalizeMonth(
        {
          ...month,
          incomeSources: sources,
          totalBudget: total,
          bankPart: newBankPart,
        },
        currentMonthKey,
        profile,
      );
      updateAndSaveMonth(updated);
    },
    [month, currentMonthKey, profile, updateAndSaveMonth],
  );

  // Categories Handlers
  const handleAddCategory = useCallback(
    (name: string, color: string, icon: string) => {
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
    },
    [month, updateAndSaveMonth],
  );

  const handleRemoveCategory = useCallback(
    (name: string) => {
      const nextCats = (month.activeCategories || []).filter((c) => c !== name);
      const updated: MonthBudget = {
        ...month,
        activeCategories: nextCats,
      };
      updateAndSaveMonth(updated);
    },
    [month, updateAndSaveMonth],
  );

  // CSV Import Handlers
  const handleBatchImportVariable = useCallback(
    (newExpenses: VariableExpense[]) => {
      let current = month;
      newExpenses.forEach((exp) => {
        current = addVariableExpense(current, exp);
      });
      updateAndSaveMonth(current);
    },
    [month, updateAndSaveMonth],
  );

  const handleBatchImportFixed = useCallback(
    (newBills: FixedExpense[]) => {
      let current = month;
      newBills.forEach((bill) => {
        current = addFixedExpense(current, bill);
      });
      updateAndSaveMonth(current);
    },
    [month, updateAndSaveMonth],
  );

  const sendVerification = useCallback(async () => {
    try {
      await sendVerificationEmail();
      setVerificationSent(true);
    } catch (e) {
      console.error(e);
    }
  }, [sendVerificationEmail]);

  // Modal openers / closers
  const openExpenseModal = useCallback((expense: VariableExpense | null = null) => {
    setSelectedExpense(expense);
    setIsExpenseModalOpen(true);
  }, []);
  const closeExpenseModal = useCallback(() => {
    setIsExpenseModalOpen(false);
    setSelectedExpense(null);
  }, []);

  const openFixedModal = useCallback((bill: FixedExpense | null = null) => {
    setSelectedFixed(bill);
    setIsFixedModalOpen(true);
  }, []);
  const closeFixedModal = useCallback(() => {
    setIsFixedModalOpen(false);
    setSelectedFixed(null);
  }, []);

  const openMoveMoneyModal = useCallback(() => setIsMoveMoneyModalOpen(true), []);
  const closeMoveMoneyModal = useCallback(() => setIsMoveMoneyModalOpen(false), []);

  const openSavingsModal = useCallback((mode: SavingsModalMode, goal: SavingGoal | null = null) => {
    setSavingsModalMode(mode);
    setSelectedGoal(goal);
    setIsSavingsModalOpen(true);
  }, []);
  const closeSavingsModal = useCallback(() => {
    setIsSavingsModalOpen(false);
    setSelectedGoal(null);
  }, []);

  const openManageCategories = useCallback(() => setIsManageCategoriesOpen(true), []);
  const closeManageCategories = useCallback(() => setIsManageCategoriesOpen(false), []);

  const openProModal = useCallback(() => setIsProModalOpen(true), []);
  const closeProModal = useCallback(() => setIsProModalOpen(false), []);

  const openCsvModal = useCallback(() => setIsCsvModalOpen(true), []);
  const closeCsvModal = useCallback(() => setIsCsvModalOpen(false), []);

  const openIncomeModal = useCallback(() => setIsIncomeModalOpen(true), []);
  const closeIncomeModal = useCallback(() => setIsIncomeModalOpen(false), []);

  const openEditMoneyPlaces = useCallback(() => setIsEditMoneyPlacesOpen(true), []);
  const closeEditMoneyPlaces = useCallback(() => setIsEditMoneyPlacesOpen(false), []);

  const openDebtModal = useCallback((debt: DebtItem | null = null) => {
    setSelectedDebt(debt);
    setIsDebtModalOpen(true);
  }, []);
  const closeDebtModal = useCallback(() => {
    setIsDebtModalOpen(false);
    setSelectedDebt(null);
  }, []);

  const value = useMemo<DashboardContextType>(
    () => ({
      user,
      profile,
      authLoading,
      isPro,
      verificationSent,
      sendVerification,
      dismissVerificationBanner,
      setDismissVerificationBanner,
      currentMonthKey,
      handlePrevMonth,
      handleNextMonth,
      month,
      goals,
      loading,
      isMounted,
      trendsMonths,
      trendsLoading,
      updateAndSaveMonth,
      updateAndSaveGoals,
      handleUpdateTotalBudget,
      handleEditMoneyPlaces,
      handleUpdateStrategy,
      handleUpdateProfile,
      handleSaveIncomeSources,
      handleAddCategory,
      handleRemoveCategory,
      handleBatchImportVariable,
      handleBatchImportFixed,
      openExpenseModal,
      closeExpenseModal,
      isExpenseModalOpen,
      selectedExpense,
      openFixedModal,
      closeFixedModal,
      isFixedModalOpen,
      selectedFixed,
      openMoveMoneyModal,
      closeMoveMoneyModal,
      isMoveMoneyModalOpen,
      openSavingsModal,
      closeSavingsModal,
      isSavingsModalOpen,
      savingsModalMode,
      selectedGoal,
      openManageCategories,
      closeManageCategories,
      isManageCategoriesOpen,
      openProModal,
      closeProModal,
      isProModalOpen,
      openCsvModal,
      closeCsvModal,
      isCsvModalOpen,
      openIncomeModal,
      closeIncomeModal,
      isIncomeModalOpen,
      openEditMoneyPlaces,
      closeEditMoneyPlaces,
      isEditMoneyPlacesOpen,
      openDebtModal,
      closeDebtModal,
      isDebtModalOpen,
      selectedDebt,
    }),
    [
      user,
      profile,
      authLoading,
      isPro,
      verificationSent,
      sendVerification,
      dismissVerificationBanner,
      setDismissVerificationBanner,
      currentMonthKey,
      handlePrevMonth,
      handleNextMonth,
      month,
      goals,
      loading,
      isMounted,
      trendsMonths,
      trendsLoading,
      updateAndSaveMonth,
      updateAndSaveGoals,
      handleUpdateTotalBudget,
      handleEditMoneyPlaces,
      handleUpdateStrategy,
      handleUpdateProfile,
      handleSaveIncomeSources,
      handleAddCategory,
      handleRemoveCategory,
      handleBatchImportVariable,
      handleBatchImportFixed,
      openExpenseModal,
      closeExpenseModal,
      isExpenseModalOpen,
      selectedExpense,
      openFixedModal,
      closeFixedModal,
      isFixedModalOpen,
      selectedFixed,
      openMoveMoneyModal,
      closeMoveMoneyModal,
      isMoveMoneyModalOpen,
      openSavingsModal,
      closeSavingsModal,
      isSavingsModalOpen,
      savingsModalMode,
      selectedGoal,
      openManageCategories,
      closeManageCategories,
      isManageCategoriesOpen,
      openProModal,
      closeProModal,
      isProModalOpen,
      openCsvModal,
      closeCsvModal,
      isCsvModalOpen,
      openIncomeModal,
      closeIncomeModal,
      isIncomeModalOpen,
      openEditMoneyPlaces,
      closeEditMoneyPlaces,
      isEditMoneyPlacesOpen,
      openDebtModal,
      closeDebtModal,
      isDebtModalOpen,
      selectedDebt,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextType {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return ctx;
}


