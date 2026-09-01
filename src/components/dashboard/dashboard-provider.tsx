'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { canExportAnything, TOOL_AREA, type HouseholdArea } from '../../lib/household-rbac';
import {
  MonthBudget,
  SavingGoal,
  SavingsActivityEntry,
  IncomeSource,
  VariableExpense,
  FixedExpense,
  DebtItem,
  StrategyId,
  UserProfile,
  normalizeMonth,
  calculateEnvelopeAmounts,
  updateSavingsActivityEntry,
  deleteSavingsActivityEntry,
  addVariableExpense,
  addFixedExpense,
  updateMoneyPlaces,
  updateBudgetStrategy,
  carryOverFixedExpenses,
} from '../../lib/store';
import { monthStartDateFor } from '../../lib/household';
import {
  subscribeMonthBudget,
  saveMonthBudget,
  subscribeSavingsGoals,
  saveSavingsGoals,
  fetchMonthsForTrends,
  getMonthBudget,
  subscribeHouseholdMonthBudget,
  saveHouseholdMonthBudget,
  subscribeHouseholdSavingsGoals,
  saveHouseholdSavingsGoals,
  getHouseholdMonthBudget,
  fetchHouseholdMonthsForTrends,
} from '../../lib/db';
import { isProUser } from '../../lib/pro-features';
import { trackEvent } from '../../lib/analytics';
import { getCurrentMonthKey } from '../../lib/utils';
import {
  readCachedMonth,
  readStoredMonthKey,
  writeCachedMonth,
  writeStoredMonthKey,
} from '../../lib/month-cache';
import { getScreenIdFromPath } from './nav-items';
import { useHousehold } from '../../lib/household-context';
import { householdStorageKey } from '../../lib/household';
import { isDemoMode, isOnboardingDoneLocally } from '../../lib/demo-mode';

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
  updateAndSaveMonth: (month: MonthBudget, area?: HouseholdArea) => void;
  updateAndSaveGoals: (goals: SavingGoal[]) => void;

  // Budget handlers
  handleUpdateTotalBudget: (newTotalBudget: number) => void;
  handleEditMoneyPlaces: (values: Record<string, number>) => void;
  handleUpdateStrategy: (strategyId: StrategyId) => void;
  handleUpdateProfile: (updatedProfile: UserProfile) => Promise<void>;
  handleSaveIncomeSources: (sources: IncomeSource[], total: number) => void;

  // Category handlers
  handleAddCategory: (name: string, color: string, icon: string) => void;

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

  // Editor for a logged savings deposit / withdrawal (Recent Activity)
  openSavingsEntryModal: (entry: SavingsActivityEntry) => void;
  closeSavingsEntryModal: () => void;
  isSavingsEntryModalOpen: boolean;
  selectedSavingsEntry: SavingsActivityEntry | null;
  handleSaveSavingsEntry: (entryId: string, patch: Partial<SavingsActivityEntry>) => void;
  handleDeleteSavingsEntry: (entryId: string) => void;

  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  isSettingsModalOpen: boolean;

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
  const { household, canEdit, isContributor, isOwner, workspace, loading: householdLoading, householdAccess, canEditArea, canViewArea, exportSections } = useHousehold();
  const householdId = workspace === 'household' ? profile?.activeHouseholdId : undefined;

  // Contributors never load private household month documents. Their invoice
  // submissions live in a separate collection with dedicated rules.
  /**
   * The start date that applies to the ACTIVE workspace — personal and
   * household keep their own. Everything that decides "which budget period are
   * we in" must go through this, never `profile.monthStartDate` directly.
   */
  const activeMonthStartDate = monthStartDateFor(profile, workspace);
  const periodContextKey = `${workspace}:${activeMonthStartDate ?? ''}`;

  // Active Month Key (YYYY-MM). When a monthly start date is configured, the
  // active month is the budget period containing today (so on the 1st the
  // month does not flip to the new calendar month until the start date).
  const today = new Date();
  const defaultMonthKey = getCurrentMonthKey(activeMonthStartDate, today);
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(defaultMonthKey);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const profileReady = Boolean(profile);
  const hydratedStartRef = useRef(false);
  const lastPeriodContextRef = useRef<string | null>(null);

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

    const isDemo = isDemoMode();

    if (!user && !isDemo) {
      router.push('/login');
      return;
    }

    // Onboarding must always be the first screen after signup — keep
    // bouncing back to it until it has been completed.
    // Local fallbacks: the flag written by the onboarding page and any
    // previously saved budget data (covers the Firebase-save timeout path
    // and pre-existing demo data).
    const onboardingDoneLocally = isOnboardingDoneLocally(defaultMonthKey);

    if (isDemo) {
      if (!onboardingDoneLocally) {
        router.replace('/onboarding');
      }
      return;
    }

    if (workspace === 'household' && householdId) {
      if (householdLoading) return;
      // Only a proven loss of membership unlinks the workspace. While the
      // subscription is still connecting (or the network is down) the
      // household is simply `null`, and resetting here silently ejected
      // people from their shared budget on a slow connection.
      if (!household && householdAccess === 'denied') {
        updateProfileData({ activeWorkspace: 'personal' }).catch(() => {});
        return;
      }
      if (!household) return;
      const householdOnboardedLocally =
        typeof window !== 'undefined' &&
        localStorage.getItem(`flousy_household_${householdId}_onboarding_done`) === 'true';
      // Only the OWNER is bounced into new-household onboarding: it imports the
      // owner's personal budget, and a member can't write the household doc, so
      // for them the cloud `onboardingComplete` never flips and they would be
      // re-shown the "new household" screen on later logins.
      if (isOwner && household.onboardingComplete === false && !householdOnboardedLocally) {
        router.replace('/onboarding?scope=household');
        return;
      }
    }

    if (user && profile && profile.onboardingComplete === false && workspace !== 'household') {
      if (!onboardingDoneLocally) {
        router.replace('/onboarding');
      } else {
        // Self-heal: onboarding was finished on this device but the flag
        // never made it to the cloud profile.
        updateProfileData({ onboardingComplete: true }).catch(() => {});
      }
    }
  }, [user, profile, authLoading, router, defaultMonthKey, updateProfileData, workspace, householdId, household, householdLoading, householdAccess, isOwner]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Honour the last viewed month from storage so tab / month navigation does
  // not snap back to "today's period" and trigger a loading refetch. Only
  // jump to the period containing today when the user actually changes the
  // monthly start date in settings.
  useEffect(() => {
    if (authLoading || (user && !profileReady)) return;

    const nextStart = activeMonthStartDate;

    if (!hydratedStartRef.current) {
      hydratedStartRef.current = true;
      lastPeriodContextRef.current = periodContextKey;
      const stored = readStoredMonthKey();
      const resolved = getCurrentMonthKey(nextStart);
      // A stored calendar-month key can be stale when the app is reopened
      // before payday (for example, Sep 1 with a Sep 27 salary day). Prefer
      // the active salary period in that case so the previous month's data is
      // shown instead of an empty new calendar-month document.
      const [resolvedYear, resolvedMonth] = resolved.split('-').map(Number);
      const [storedYear, storedMonth] = stored?.split('-').map(Number) || [];
      const todayCalendarKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const storedIsPrematureCalendarMonth =
        Boolean(stored) &&
        stored === todayCalendarKey &&
        (storedYear !== resolvedYear || storedMonth !== resolvedMonth);
      const initialKey = stored && !storedIsPrematureCalendarMonth ? stored : resolved;
      setCurrentMonthKey((prev) => (prev === initialKey ? prev : initialKey));
      writeStoredMonthKey(initialKey);
      return;
    }

    // Keyed on workspace AND start date: switching workspace has to re-resolve
    // even when the user never edited a start date, because the two workspaces
    // can be paid on different days.
    if (lastPeriodContextRef.current === periodContextKey) return;
    lastPeriodContextRef.current = periodContextKey;
    const resolved = getCurrentMonthKey(nextStart);
    setCurrentMonthKey(resolved);
    writeStoredMonthKey(resolved);
  }, [authLoading, user, profileReady, activeMonthStartDate, periodContextKey]);

  useEffect(() => {
    writeStoredMonthKey(currentMonthKey);
  }, [currentMonthKey]);

  // Modal Open States
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<VariableExpense | null>(null);

  const [isMoveMoneyModalOpen, setIsMoveMoneyModalOpen] = useState(false);

  const [isFixedModalOpen, setIsFixedModalOpen] = useState(false);
  const [selectedFixed, setSelectedFixed] = useState<FixedExpense | null>(null);

  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [savingsModalMode, setSavingsModalMode] = useState<SavingsModalMode>('create');
  const [selectedGoal, setSelectedGoal] = useState<SavingGoal | null>(null);

  const [isSavingsEntryModalOpen, setIsSavingsEntryModalOpen] = useState(false);
  const [selectedSavingsEntry, setSelectedSavingsEntry] = useState<SavingsActivityEntry | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
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

      if (householdId) {
        const prev = await getHouseholdMonthBudget(householdId, prevKey);
        return prev || undefined;
      } else if (user) {
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
    [user, profile, householdId],
  );

  // 1. Subscribe or load month budget.
  // Hydrate from localStorage first so tab / month navigation can paint the
  // last known document instantly instead of flashing the dashboard skeleton
  // while Firestore catches up. Snapshots are written back to the same key.
  useEffect(() => {
    // Do not subscribe to the personal workspace while the authenticated
    // profile (and its selected workspace) is still hydrating. Otherwise the
    // personal month paints briefly before the household subscription wins.
    if (authLoading || (user && !profileReady)) {
      setLoading(true);
      return;
    }

    const activeProfile = profileRef.current;
    const storageKey = householdStorageKey(householdId, currentMonthKey);
    const cached = readCachedMonth(storageKey, currentMonthKey, activeProfile);
    if (cached) {
      setMonth(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const persist = (data: MonthBudget) => {
      writeCachedMonth(storageKey, data);
    };

    if (householdId && !isContributor) {
      const unsub = subscribeHouseholdMonthBudget(householdId, currentMonthKey, async (data) => {
        if (data) {
          setMonth(data);
          persist(data);
        } else {
          const fresh = normalizeMonth({ totalBudget: 0 }, currentMonthKey, activeProfile);
          setMonth(fresh);
          persist(fresh);
        }
        setLoading(false);
      });
      return () => unsub();
    } else if (householdId && isContributor) {
      setMonth(normalizeMonth({ totalBudget: 0 }, currentMonthKey, activeProfile));
      setLoading(false);
      return;
    } else if (user) {
      const unsub = subscribeMonthBudget(user.uid, currentMonthKey, async (data) => {
        if (data) {
          setMonth(data);
          persist(data);
        } else {
          // Fetch previous month for rollover
          const previousMonth = await getPreviousMonth(currentMonthKey);

          // If no month document exists in Firestore, check local storage or initialize clean default
          const local = cached ?? readCachedMonth(`flousy_month_${currentMonthKey}`, currentMonthKey, activeProfile);
          if (local) {
            setMonth(local);
            persist(local);
          } else {
            const clean = normalizeMonth(
              previousMonth
                ? {
                    totalBudget: previousMonth.totalBudget,
                    incomeSources: previousMonth.incomeSources,
                    activeCategories: previousMonth.activeCategories,
                    categoryIcons: previousMonth.categoryIcons,
                    categoryColors: previousMonth.categoryColors,
                  }
                : { totalBudget: 0 },
              currentMonthKey,
              activeProfile,
              previousMonth,
            );
            setMonth(clean);
            persist(clean);
          }
        }
        setLoading(false);
      });
      return () => unsub();
    } else {
      getPreviousMonth(currentMonthKey).then((previousMonth) => {
        const local = cached ?? readCachedMonth(`flousy_month_${currentMonthKey}`, currentMonthKey, activeProfile);
        const next = local ?? normalizeMonth(
          previousMonth
            ? {
                totalBudget: previousMonth.totalBudget,
                incomeSources: previousMonth.incomeSources,
                activeCategories: previousMonth.activeCategories,
                categoryIcons: previousMonth.categoryIcons,
                categoryColors: previousMonth.categoryColors,
              }
            : { totalBudget: 0 },
          currentMonthKey,
          activeProfile,
          previousMonth,
        );
        setMonth(next);
        persist(next);
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, householdId, isContributor, canEdit, currentMonthKey, profileReady]);

  // 2. Subscribe or load savings goals
  useEffect(() => {
    if (authLoading || (user && !profile)) return;
    if (householdId && !isContributor) {
      const unsub = subscribeHouseholdSavingsGoals(householdId, (data) => setGoals(data || []));
      return () => unsub();
    } else if (householdId && isContributor) {
      setGoals([]);
      return;
    } else if (user) {
      const unsub = subscribeSavingsGoals(user.uid, (data) => {
        setGoals(data || []);
      });
      return () => unsub();
    } else {
      setGoals([]);
    }
  }, [user, authLoading, profile, householdId, isContributor]);

  /**
   * Area-aware write gate. Every screen already hides the affordances a member
   * is not granted; this is the backstop for a stale handler, a modal that
   * outlived a permission change, or an import path that skips the UI.
   * `canEdit` is the coarse role check that mirrors the Firestore rule on
   * `/households/{hid}/months/{key}`; `canEditArea` is the fine-grained matrix.
   */
  const mayWriteArea = useCallback(
    (area: HouseholdArea) => !householdId || (canEdit && canEditArea(area, true)),
    [householdId, canEdit, canEditArea],
  );

  // Helper to persist month updates locally + cloud
  const updateAndSaveMonth = useCallback(
    (newMonth: MonthBudget, area?: HouseholdArea) => {
      if (householdId && !canEdit) return;
      if (area && !mayWriteArea(area)) return;
      setMonth(newMonth);
      // Never let a local write abort the cloud write: a raw setItem here threw
      // QuotaExceededError (Safari under pressure, blocked/partitioned storage)
      // straight out of the save callback, so the edit looked applied and was
      // never sent to Firestore. writeCachedMonth is the swallow-and-continue
      // wrapper used everywhere else.
      writeCachedMonth(householdStorageKey(householdId, currentMonthKey), newMonth);
      if (householdId) {
        saveHouseholdMonthBudget(householdId, currentMonthKey, { ...newMonth, updatedByUserId: user?.uid }).catch((e) => console.error(e));
      } else if (user) {
        saveMonthBudget(user.uid, currentMonthKey, newMonth).catch((e) => console.error(e));
      }
    },
    [currentMonthKey, user, householdId, canEdit, mayWriteArea],
  );

  // Helper to persist goals updates locally + cloud
  const updateAndSaveGoals = useCallback(
    (newGoals: SavingGoal[]) => {
      if (householdId && !canEdit) return;
      setGoals(newGoals);
      try {
        localStorage.setItem(householdId ? `flousy_household_${householdId}_savings_goals` : 'flousy_savings_goals', JSON.stringify(newGoals));
      } catch {
        /* quota / private mode — the Firestore write below still runs */
      }
      if (householdId) {
        saveHouseholdSavingsGoals(householdId, newGoals).catch((e) => console.error(e));
      } else if (user) {
        saveSavingsGoals(user.uid, newGoals).catch((e) => console.error(e));
      }
    },
    [user, householdId, canEdit],
  );

  // Carry over recurring fixed expenses from previous month
  const carryOverRecurring = useCallback(
    async (monthKey: string) => {
      const [y, m] = monthKey.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      if (householdId || user) {
        const prev = householdId
          ? await getHouseholdMonthBudget(householdId, prevKey)
          : user
            ? await getMonthBudget(user.uid, prevKey)
            : undefined;
        if (prev) {
          const withCarry = carryOverFixedExpenses(month, prev);
          if (withCarry.fixedExpenses.length > month.fixedExpenses.length) updateAndSaveMonth(withCarry);
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
    [month, profile, updateAndSaveMonth, user, householdId],
  );

  // Automatically carry over recurring bills when entering a fresh month.
  // A fresh month starts with totalBudget = 0, so this must also fire when the
  // budget is first set (not only on month navigation / reload). A per-month
  // guard keeps it running at most once per month: deleting every bill and
  // expense mid-month must not resurrect the carried copies.
  const carryOverDoneForRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !month) return;
    if (carryOverDoneForRef.current === currentMonthKey) return;
    if (!(month.totalBudget > 0)) return;

    const fixedCount = (month.fixedExpenses || []).length;
    const variableCount = (month.variableExpenses || []).length;
    // Mark the month as handled either way: only a truly fresh, empty month is
    // ever auto-populated.
    carryOverDoneForRef.current = currentMonthKey;
    if (fixedCount === 0 && variableCount === 0) {
      carryOverRecurring(currentMonthKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthKey, loading, month?.totalBudget, month?.fixedExpenses?.length, month?.variableExpenses?.length]);

  // Load multi-month data when the Trends screen is active
  const onTrendsScreen = getScreenIdFromPath(pathname) === 'trends';
  useEffect(() => {
    if (onTrendsScreen && month.totalBudget > 0) {
      setTrendsLoading(true);
      (householdId ? fetchHouseholdMonthsForTrends(householdId, currentMonthKey, 6) : fetchMonthsForTrends(user?.uid, currentMonthKey, 6))
        .then((data) => setTrendsMonths(data))
        .catch(() => {})
        .finally(() => setTrendsLoading(false));
    }
  }, [onTrendsScreen, currentMonthKey, user?.uid, householdId, month.totalBudget]);

  // Apply a month key immediately: persist it, paint any cached document so
  // the skeleton never flashes on a month the user has already opened, then
  // let the subscribe effect revalidate in the background.
  const applyMonthKey = useCallback(
    (nextKey: string) => {
      writeStoredMonthKey(nextKey);
      const cached = readCachedMonth(
        householdStorageKey(householdId, nextKey),
        nextKey,
        profileRef.current,
      );
      if (cached) {
        setMonth(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setCurrentMonthKey(nextKey);
    },
    [householdId],
  );

  // Month navigation
  const handlePrevMonth = useCallback(() => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    applyMonthKey(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  }, [applyMonthKey, currentMonthKey]);

  const handleNextMonth = useCallback(() => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    applyMonthKey(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  }, [applyMonthKey, currentMonthKey]);

  // Budget handlers
  const handleUpdateTotalBudget = useCallback(
    (newTotalBudget: number) => {
      if (!mayWriteArea('balances')) return;
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
          monthlySavingsTarget: calculateEnvelopeAmounts(safeBudget, month.strategyId, month.customRatios).savings,
        },
        currentMonthKey,
        profile,
      );

      updateAndSaveMonth(updated, 'balances');
      trackEvent('update_total_budget', { amount: safeBudget });
    },
    [month, currentMonthKey, profile, updateAndSaveMonth, mayWriteArea],
  );

  const handleEditMoneyPlaces = useCallback(
    (values: Record<string, number>) => {
      if (!mayWriteArea('balances')) return;
      const updated = updateMoneyPlaces(month, values);
      updateAndSaveMonth(updated, 'balances');
    },
    [month, updateAndSaveMonth, mayWriteArea],
  );

  const handleUpdateStrategy = useCallback(
    (strategyId: StrategyId) => {
      if (!mayWriteArea('balances')) return;
      const updated = updateBudgetStrategy(month, strategyId);
      updateAndSaveMonth(updated, 'balances');
      trackEvent('change_strategy', { strategyId });
    },
    [month, updateAndSaveMonth, mayWriteArea],
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
    (sources: IncomeSource[], total: number) => {
      // Income is its own RBAC area: an `editAll` grant on expenses must not
      // let a member rewrite the household's income sources or total budget.
      if (!mayWriteArea('income')) return;
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
      updateAndSaveMonth(updated, 'income');
    },
    [month, currentMonthKey, profile, updateAndSaveMonth, mayWriteArea],
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
      updateAndSaveMonth(updated, 'settings');
    },
    [month, updateAndSaveMonth],
  );

  // CSV Import Handlers
  const handleBatchImportVariable = useCallback(
    (newExpenses: VariableExpense[]) => {
      if (!mayWriteArea('expenses')) return;
      let current = month;
      newExpenses.forEach((exp) => {
        current = addVariableExpense(current, exp);
      });
      updateAndSaveMonth(current, 'expenses');
    },
    [month, updateAndSaveMonth, mayWriteArea],
  );

  const handleBatchImportFixed = useCallback(
    (newBills: FixedExpense[]) => {
      if (!mayWriteArea('fixedBills')) return;
      let current = month;
      newBills.forEach((bill) => {
        current = addFixedExpense(current, bill);
      });
      updateAndSaveMonth(current, 'fixedBills');
    },
    [month, updateAndSaveMonth, mayWriteArea],
  );

  const sendVerification = useCallback(async () => {
    try {
      await sendVerificationEmail();
      setVerificationSent(true);
    } catch (e) {
      console.error(e);
    }
  }, [sendVerificationEmail]);

  // Modal openers / closers.
  //
  // Every opener checks the member's RBAC area before it opens. Hiding the
  // button is the friendly layer; this is what actually stops a write, so a
  // stale handler, a keyboard shortcut or a deep-linked entry point can never
  // reach an editor for an area the member does not hold.
  const openExpenseModal = useCallback((expense: VariableExpense | null = null) => {
    if (!mayWriteArea('expenses')) return;
    setSelectedExpense(expense);
    setIsExpenseModalOpen(true);
  }, [mayWriteArea]);
  const closeExpenseModal = useCallback(() => {
    setIsExpenseModalOpen(false);
    setSelectedExpense(null);
  }, []);

  const openFixedModal = useCallback((bill: FixedExpense | null = null) => {
    if (!mayWriteArea('fixedBills')) return;
    setSelectedFixed(bill);
    setIsFixedModalOpen(true);
  }, [mayWriteArea]);
  const closeFixedModal = useCallback(() => {
    setIsFixedModalOpen(false);
    setSelectedFixed(null);
  }, []);

  const openMoveMoneyModal = useCallback(() => {
    if (!mayWriteArea('balances')) return;
    setIsMoveMoneyModalOpen(true);
  }, [mayWriteArea]);
  const closeMoveMoneyModal = useCallback(() => setIsMoveMoneyModalOpen(false), []);

  const openSavingsModal = useCallback((mode: SavingsModalMode, goal: SavingGoal | null = null) => {
    if (!mayWriteArea('savings')) return;
    setSavingsModalMode(mode);
    setSelectedGoal(goal);
    setIsSavingsModalOpen(true);
  }, [mayWriteArea]);
  const closeSavingsModal = useCallback(() => {
    setIsSavingsModalOpen(false);
    setSelectedGoal(null);
  }, []);

  const openSavingsEntryModal = useCallback((entry: SavingsActivityEntry) => {
    if (!mayWriteArea('savings')) return;
    setSelectedSavingsEntry(entry);
    setIsSavingsEntryModalOpen(true);
  }, [mayWriteArea]);
  const closeSavingsEntryModal = useCallback(() => {
    setIsSavingsEntryModalOpen(false);
    setSelectedSavingsEntry(null);
  }, []);

  // Correcting a logged deposit rewinds the original money movement and
  // replays the edited one, so the month's savings plan follows along.
  const handleSaveSavingsEntry = useCallback(
    (entryId: string, patch: Partial<SavingsActivityEntry>) => {
      if (!mayWriteArea('savings')) return;
      const res = updateSavingsActivityEntry(month, goals, entryId, patch);
      updateAndSaveMonth(res.month, 'savings');
      updateAndSaveGoals(res.goals);
      trackEvent('edit_savings_entry', { type: patch.type });
    },
    [month, goals, updateAndSaveMonth, updateAndSaveGoals, mayWriteArea],
  );

  const handleDeleteSavingsEntry = useCallback(
    (entryId: string) => {
      if (!mayWriteArea('savings')) return;
      const res = deleteSavingsActivityEntry(month, goals, entryId);
      updateAndSaveMonth(res.month, 'savings');
      updateAndSaveGoals(res.goals);
      trackEvent('delete_savings_entry', {});
    },
    [month, goals, updateAndSaveMonth, updateAndSaveGoals, mayWriteArea],
  );

  const openSettingsModal = useCallback(() => {
    if (!mayWriteArea(TOOL_AREA.settings)) return;
    setIsSettingsModalOpen(true);
  }, [mayWriteArea]);
  const closeSettingsModal = useCallback(() => setIsSettingsModalOpen(false), []);

  const openProModal = useCallback(() => {
    if (workspace === 'household') return;
    setIsProModalOpen(true);
  }, [workspace]);
  const closeProModal = useCallback(() => setIsProModalOpen(false), []);

  const openCsvModal = useCallback(() => {
    // Import writes to several areas at once; export reads them. Require view
    // on at least one exported section, and edit on the ones being imported.
    if (householdId && !canExportAnything(exportSections)) return;
    setIsCsvModalOpen(true);
  }, [householdId, exportSections]);
  const closeCsvModal = useCallback(() => setIsCsvModalOpen(false), []);

  // Income is readable in view-only mode, so the gate here is `canViewArea`;
  // the modal itself renders read-only unless the member may edit income.
  const openIncomeModal = useCallback(() => {
    if (!canViewArea('income')) return;
    setIsIncomeModalOpen(true);
  }, [canViewArea]);
  const closeIncomeModal = useCallback(() => setIsIncomeModalOpen(false), []);

  const openEditMoneyPlaces = useCallback(() => {
    if (!mayWriteArea('balances')) return;
    setIsEditMoneyPlacesOpen(true);
  }, [mayWriteArea]);
  const closeEditMoneyPlaces = useCallback(() => setIsEditMoneyPlacesOpen(false), []);

  const openDebtModal = useCallback((debt: DebtItem | null = null) => {
    if (!mayWriteArea('debts')) return;
    setSelectedDebt(debt);
    setIsDebtModalOpen(true);
  }, [mayWriteArea]);
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
      openSavingsEntryModal,
      closeSavingsEntryModal,
      isSavingsEntryModalOpen,
      selectedSavingsEntry,
      handleSaveSavingsEntry,
      handleDeleteSavingsEntry,
      openSettingsModal,
      closeSettingsModal,
      isSettingsModalOpen,
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
      openSavingsEntryModal,
      closeSavingsEntryModal,
      isSavingsEntryModalOpen,
      selectedSavingsEntry,
      handleSaveSavingsEntry,
      handleDeleteSavingsEntry,
      openSettingsModal,
      closeSettingsModal,
      isSettingsModalOpen,
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


