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
import { TOOL_AREA, type HouseholdArea } from '../../lib/household-rbac';
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
  type MonthConfiguration,
  normalizeMonth,
  calculateEnvelopeAmounts,
  updateSavingsActivityEntry,
  deleteSavingsActivityEntry,
  addVariableExpense,
  addFixedExpense,
  updateMoneyPlaces,
  updateBudgetStrategy,
  carryOverFixedExpenses,
  carryOverIncomeSources,
  calculateReceivedIncome,
  adjustPlaceBalance,
} from '../../lib/store';
import {
  subscribeMonthBudget,
  subscribeSavingsGoals,
  fetchMonthsForTrends,
  getMonthBudget,
  subscribeHouseholdMonthBudget,
  subscribeHouseholdSavingsGoals,
  getHouseholdMonthBudget,
  fetchHouseholdMonthsForTrends,
  commitFinanceMutation,
  getFinanceState,
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
import { useCurrency } from '../../lib/currency-context';
import {
  FinanceConflictError,
  listFinanceMutations,
  newFinanceMutationId,
  putFinanceMutation,
  removeFinanceMutation,
  type FinanceMutation,
  type FinanceSyncState,
} from '../../lib/finance-sync';

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
  updateAndSaveFinance: (month: MonthBudget, goals: SavingGoal[]) => void;
  syncState: FinanceSyncState;
  syncError: string | null;
  pendingMutations: number;
  retrySync: () => void;
  discardPendingChanges: () => Promise<void>;

  // Budget handlers
  handleUpdateTotalBudget: (newTotalBudget: number) => void;
  handleEditMoneyPlaces: (values: Record<string, number>, note?: string) => void;
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
  const {
    household,
    canEdit,
    isContributor,
    isOwner,
    workspace,
    loading: householdLoading,
    householdAccess,
    canEditArea,
    canViewArea,
  } = useHousehold();
  const { configuredCurrency, setPeriodCurrency } = useCurrency();
  const householdId = workspace === 'household' ? profile?.activeHouseholdId : undefined;
  const budgetStartDate = workspace === 'household' ? household?.monthStartDate : profile?.monthStartDate;
  const budgetProfile: MonthConfiguration | null = useMemo(() => (
    workspace === 'household'
      ? {
          // Do not fall back to personal preferences: household configuration
          // is authoritative and loading is gated until it is available.
          currency: household?.currency || 'MAD',
          monthStartDate: household?.monthStartDate,
          defaultCategoryBudgets: household?.defaultCategoryBudgets,
          enableRollover: household?.enableRollover,
          activeCategories: household?.activeCategories,
          categoryColors: household?.categoryColors,
          categoryIcons: household?.categoryIcons,
        }
      : profile
  ), [
    workspace,
    household?.currency,
    household?.monthStartDate,
    household?.defaultCategoryBudgets,
    household?.enableRollover,
    household?.activeCategories,
    household?.categoryColors,
    household?.categoryIcons,
    profile,
  ]);

  // Contributors never load private household month documents. Their invoice
  // submissions live in a separate collection with dedicated rules.
  // Workspace is part of the key so switching between equal start dates still
  // resolves and loads the correct period.
  const periodContextKey = `${workspace}:${budgetStartDate ?? ''}`;

  // Active Month Key (YYYY-MM). When a monthly start date is configured, the
  // active month is the budget period containing today (so on the 1st the
  // month does not flip to the new calendar month until the start date).
  const today = new Date();
  const defaultMonthKey = getCurrentMonthKey(budgetStartDate, today);
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(defaultMonthKey);
  const profileRef = useRef<MonthConfiguration | null>(budgetProfile);
  profileRef.current = budgetProfile;
  const profileReady = Boolean(profile);
  const hydratedStartRef = useRef(false);
  const lastPeriodContextRef = useRef<string | null>(null);

  // Core State
  const [month, setMonth] = useState<MonthBudget>(() =>
    normalizeMonth({ totalBudget: 0 }, undefined, budgetProfile),
  );
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const monthRef = useRef(month);
  const goalsRef = useRef(goals);
  monthRef.current = month;
  goalsRef.current = goals;
  const [loading, setLoading] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<FinanceSyncState>('local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingMutations, setPendingMutations] = useState(0);
  const [outboxHydrated, setOutboxHydrated] = useState(false);
  const flushInProgressRef = useRef(false);
  const pendingCurrentTargetRef = useRef(0);
  const pendingGoalsRef = useRef(0);
  const workspaceId = householdId || user?.uid;
  const activeTargetRef = useRef('');
  activeTargetRef.current = `${workspace}:${workspaceId || 'local'}:${currentMonthKey}`;

  // Every month carries a currency snapshot. Configuration changes therefore
  // apply to newly created periods without relabelling historical records.
  useEffect(() => {
    setPeriodCurrency(month.currency || configuredCurrency);
  }, [month.currency, configuredCurrency, setPeriodCurrency]);
  useEffect(() => () => setPeriodCurrency(null), [setPeriodCurrency]);

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

  // Rehydrate the durable IndexedDB outbox before attaching cloud listeners.
  // This prevents an older snapshot from flashing over unsent local edits after
  // a reload or an offline browser restart.
  useEffect(() => {
    let cancelled = false;
    setOutboxHydrated(false);
    pendingCurrentTargetRef.current = 0;
    pendingGoalsRef.current = 0;
    if (!user || !workspaceId) {
      pendingCurrentTargetRef.current = 0;
      pendingGoalsRef.current = 0;
      setPendingMutations(0);
      setSyncState('local');
      setOutboxHydrated(true);
      return () => { cancelled = true; };
    }
    void listFinanceMutations({
      actorId: user.uid,
      workspace,
      workspaceId,
    }).then((queued) => {
      if (cancelled) return;
      const current = queued.filter((mutation) => mutation.monthKey === currentMonthKey);
      const goalMutations = queued.filter((mutation) => Boolean(mutation.nextGoals));
      pendingCurrentTargetRef.current = current.length;
      pendingGoalsRef.current = goalMutations.length;
      setPendingMutations(queued.length);
      if (current.length > 0) {
        const latest = current[current.length - 1];
        monthRef.current = latest.nextMonth;
        setMonth(latest.nextMonth);
        writeCachedMonth(householdStorageKey(householdId, currentMonthKey), latest.nextMonth);
      }
      const latestGoals = goalMutations[goalMutations.length - 1]?.nextGoals;
      if (latestGoals) {
        goalsRef.current = latestGoals;
        setGoals(latestGoals);
      }
      if (queued.some((mutation) => mutation.lastError === 'conflict')) {
        setSyncState('conflict');
        setSyncError('Your local edit conflicts with a newer change from another device.');
      } else {
        setSyncState(queued.length > 0 ? 'pending' : 'saved');
        setSyncError(null);
      }
      setOutboxHydrated(true);
    }).catch((error) => {
      if (cancelled) return;
      setSyncError(error instanceof Error ? error.message : String(error));
      setSyncState('failed');
      setOutboxHydrated(true);
    });
    return () => { cancelled = true; };
  }, [user, workspace, workspaceId, householdId, currentMonthKey]);

  // Honour the last viewed month from storage so tab / month navigation does
  // not snap back to "today's period" and trigger a loading refetch. Only
  // jump to the period containing today when the user actually changes the
  // monthly start date in settings.
  useEffect(() => {
    if (authLoading || (user && !profileReady)) return;

    const nextStart = budgetStartDate;

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
  }, [authLoading, user, profileReady, budgetStartDate, periodContextKey]);

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
        const prev = await getHouseholdMonthBudget(householdId, prevKey, profileRef.current);
        return prev || undefined;
      } else if (user) {
        const prev = await getMonthBudget(user.uid, prevKey, profileRef.current);
        return prev || undefined;
      } else {
        try {
          const local = localStorage.getItem(`flousy_month_${prevKey}`);
          if (local) {
            return normalizeMonth(JSON.parse(local), prevKey, budgetProfile);
          }
        } catch {
          /* ignore */
        }
      }
      return undefined;
    },
    [user, budgetProfile, householdId],
  );

  // 1. Subscribe or load month budget.
  // Hydrate from localStorage first so tab / month navigation can paint the
  // last known document instantly instead of flashing the dashboard skeleton
  // while Firestore catches up. Snapshots are written back to the same key.
  useEffect(() => {
    // Do not subscribe to the personal workspace while the authenticated
    // profile (and its selected workspace) is still hydrating. Otherwise the
    // personal month paints briefly before the household subscription wins.
    if (
      authLoading
      || (user && !profileReady)
      || !outboxHydrated
      || (householdId && householdLoading)
    ) {
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
        if (pendingCurrentTargetRef.current > 0) {
          setLoading(false);
          return;
        }
        if (data) {
          setMonth(data);
          persist(data);
        } else {
          const fresh = normalizeMonth({ totalBudget: 0 }, currentMonthKey, activeProfile);
          setMonth(fresh);
          persist(fresh);
        }
        setLoading(false);
      }, activeProfile);
      return () => unsub();
    } else if (householdId && isContributor) {
      setMonth(normalizeMonth({ totalBudget: 0 }, currentMonthKey, activeProfile));
      setLoading(false);
      return;
    } else if (user) {
      const unsub = subscribeMonthBudget(user.uid, currentMonthKey, async (data) => {
        if (pendingCurrentTargetRef.current > 0) {
          setLoading(false);
          return;
        }
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
                    incomeSources: carryOverIncomeSources(previousMonth, currentMonthKey),
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
      }, activeProfile);
      return () => unsub();
    } else {
      getPreviousMonth(currentMonthKey).then((previousMonth) => {
        const local = cached ?? readCachedMonth(`flousy_month_${currentMonthKey}`, currentMonthKey, activeProfile);
        const next = local ?? normalizeMonth(
          previousMonth
            ? {
                totalBudget: previousMonth.totalBudget,
                incomeSources: carryOverIncomeSources(previousMonth, currentMonthKey),
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
  }, [
    user,
    authLoading,
    householdId,
    householdLoading,
    isContributor,
    canEdit,
    currentMonthKey,
    profileReady,
    outboxHydrated,
    budgetProfile,
  ]);

  // 2. Subscribe or load savings goals
  useEffect(() => {
    if (authLoading || (user && !profile) || !outboxHydrated) return;
    const acceptGoals = (data: SavingGoal[]) => {
      if (pendingGoalsRef.current > 0) return;
      goalsRef.current = data || [];
      setGoals(data || []);
    };
    if (householdId && !isContributor) {
      const unsub = subscribeHouseholdSavingsGoals(householdId, acceptGoals);
      return () => unsub();
    } else if (householdId && isContributor) {
      setGoals([]);
      return;
    } else if (user) {
      const unsub = subscribeSavingsGoals(user.uid, acceptGoals);
      return () => unsub();
    } else {
      setGoals([]);
    }
  }, [user, authLoading, profile, householdId, isContributor, outboxHydrated]);

  const flushRequestedRef = useRef(false);
  const flushLatestRef = useRef<() => Promise<void>>(async () => {});
  const flushOutbox = useCallback(async () => {
    if (!user || !workspaceId || !outboxHydrated) return;
    const target = `${workspace}:${workspaceId}:${currentMonthKey}`;
    const isActiveTarget = () => activeTargetRef.current === target;
    // A previous render may have queued this callback while the user switched
    // workspace or budget period. Its writes may finish safely, but it must not
    // paint the old workspace over the new one.
    if (!isActiveTarget()) return;
    if (flushInProgressRef.current) {
      flushRequestedRef.current = true;
      return;
    }
    flushInProgressRef.current = true;
    let latestCurrent: MonthBudget | null = null;
    let latestGoals: SavingGoal[] | null = null;
    try {
      const queued = await listFinanceMutations({ actorId: user.uid, workspace, workspaceId });
      if (isActiveTarget()) setPendingMutations(queued.length);
      for (const mutation of queued) {
        if (mutation.lastError === 'conflict') {
          if (isActiveTarget()) {
            setSyncState('conflict');
            setSyncError('Your local edit conflicts with a newer change from another device.');
          }
          break;
        }
        try {
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          const timeout = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error('Sync timed out. Your change remains queued.')),
              15000,
            );
          });
          let result: Awaited<ReturnType<typeof commitFinanceMutation>>;
          try {
            result = await Promise.race([
              commitFinanceMutation(mutation, profileRef.current),
              timeout,
            ]);
          } finally {
            if (timeoutId) clearTimeout(timeoutId);
          }
          await removeFinanceMutation(mutation.id);
          if (mutation.monthKey === currentMonthKey) latestCurrent = result.month;
          if (result.goals) latestGoals = result.goals;
        } catch (error) {
          const conflict = error instanceof FinanceConflictError;
          await putFinanceMutation({
            ...mutation,
            attempts: mutation.attempts + 1,
            lastError: conflict ? 'conflict' : (error instanceof Error ? error.message : String(error)),
          });
          if (isActiveTarget()) {
            setSyncState(conflict ? 'conflict' : 'failed');
            setSyncError(
              conflict
                ? 'Your local edit conflicts with a newer change from another device.'
                : 'Could not sync. Your change is safely queued on this device.',
            );
          }
          break;
        }
      }

      const remaining = await listFinanceMutations({ actorId: user.uid, workspace, workspaceId });
      const currentRemaining = remaining.filter((mutation) => mutation.monthKey === currentMonthKey);
      const goalRemaining = remaining.filter((mutation) => Boolean(mutation.nextGoals));
      if (isActiveTarget()) {
        pendingCurrentTargetRef.current = currentRemaining.length;
        pendingGoalsRef.current = goalRemaining.length;
        setPendingMutations(remaining.length);
        if (currentRemaining.length === 0 && latestCurrent) {
          monthRef.current = latestCurrent;
          setMonth(latestCurrent);
          writeCachedMonth(householdStorageKey(householdId, currentMonthKey), latestCurrent);
        }
        if (goalRemaining.length === 0 && latestGoals) {
          goalsRef.current = latestGoals;
          setGoals(latestGoals);
        }
        if (remaining.length === 0) {
          setSyncState('saved');
          setSyncError(null);
        } else if (remaining.some((mutation) => mutation.lastError === 'conflict')) {
          setSyncState('conflict');
          setSyncError('Your local edit conflicts with a newer change from another device.');
        } else {
          setSyncState((current) => current === 'failed' ? current : 'pending');
        }
      }
    } finally {
      flushInProgressRef.current = false;
      if (flushRequestedRef.current) {
        flushRequestedRef.current = false;
        // Always invoke the callback for the latest workspace/render. Calling
        // this closure again could otherwise keep flushing the workspace the
        // user just left and strand the newly active queue.
        queueMicrotask(() => { void flushLatestRef.current(); });
      }
    }
  }, [user, workspace, workspaceId, outboxHydrated, currentMonthKey, householdId]);
  flushLatestRef.current = flushOutbox;

  useEffect(() => {
    if (!outboxHydrated || !user || !workspaceId) return;
    void flushOutbox();
    const retryWhenOnline = () => { void flushOutbox(); };
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [outboxHydrated, user, workspaceId, flushOutbox]);

  /** Backstop for stale handlers and modals that outlive a role change. */
  const mayWriteArea = useCallback(
    (area: HouseholdArea) => !householdId || (canEdit && canEditArea(area, true)),
    [householdId, canEdit, canEditArea],
  );

  const enqueueFinanceUpdate = useCallback((
    newMonth: MonthBudget,
    newGoals?: SavingGoal[],
    area?: HouseholdArea,
  ) => {
    if (householdId && (!canEdit || (area && !mayWriteArea(area)))) return;
    const baseMonth = monthRef.current;
    const baseGoals = goalsRef.current;
    monthRef.current = newMonth;
    setMonth(newMonth);
    writeCachedMonth(householdStorageKey(householdId, currentMonthKey), newMonth);
    if (newGoals) {
      goalsRef.current = newGoals;
      setGoals(newGoals);
      try {
        localStorage.setItem(
          householdId ? `flousy_household_${householdId}_savings_goals` : 'flousy_savings_goals',
          JSON.stringify(newGoals),
        );
      } catch {
        // IndexedDB outbox remains the durable source even if this paint cache is unavailable.
      }
    }
    if (!user || !workspaceId) {
      setSyncState('local');
      return;
    }

    const mutation: FinanceMutation = {
      version: 1,
      id: newFinanceMutationId(),
      actorId: user.uid,
      workspace,
      workspaceId,
      monthKey: currentMonthKey,
      baseMonth,
      nextMonth: newMonth,
      ...(newGoals ? { baseGoals, nextGoals: newGoals } : {}),
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    pendingCurrentTargetRef.current += 1;
    if (newGoals) pendingGoalsRef.current += 1;
    setPendingMutations((count) => count + 1);
    setSyncState('pending');
    setSyncError(null);
    void putFinanceMutation(mutation)
      .then(() => flushOutbox())
      .catch((error) => {
        pendingCurrentTargetRef.current = Math.max(0, pendingCurrentTargetRef.current - 1);
        if (newGoals) pendingGoalsRef.current = Math.max(0, pendingGoalsRef.current - 1);
        setPendingMutations((count) => Math.max(0, count - 1));
        setSyncState('failed');
        setSyncError(error instanceof Error ? error.message : String(error));
      });
  }, [householdId, canEdit, mayWriteArea, currentMonthKey, user, workspaceId, workspace, flushOutbox]);

  const updateAndSaveMonth = useCallback(
    (newMonth: MonthBudget, area?: HouseholdArea) => enqueueFinanceUpdate(newMonth, undefined, area),
    [enqueueFinanceUpdate],
  );
  const updateAndSaveGoals = useCallback(
    (newGoals: SavingGoal[]) => enqueueFinanceUpdate(monthRef.current, newGoals, 'savings'),
    [enqueueFinanceUpdate],
  );
  const updateAndSaveFinance = useCallback(
    (newMonth: MonthBudget, newGoals: SavingGoal[]) => enqueueFinanceUpdate(newMonth, newGoals, 'savings'),
    [enqueueFinanceUpdate],
  );
  const retrySync = useCallback(() => {
    setSyncState('pending');
    setSyncError(null);
    void flushOutbox();
  }, [flushOutbox]);

  const discardPendingChanges = useCallback(async () => {
    if (!user || !workspaceId) return;
    const target = `${workspace}:${workspaceId}:${currentMonthKey}`;
    // Fetch first. A failed read must never delete the only durable local copy.
    const remote = await getFinanceState(workspace, workspaceId, currentMonthKey, profileRef.current);
    const queued = await listFinanceMutations({
      actorId: user.uid,
      workspace,
      workspaceId,
      monthKey: currentMonthKey,
    });
    await Promise.all(queued.map((mutation) => removeFinanceMutation(mutation.id)));
    const remaining = await listFinanceMutations({ actorId: user.uid, workspace, workspaceId });
    if (activeTargetRef.current !== target) return;
    const goalRemaining = remaining.filter((mutation) => Boolean(mutation.nextGoals));
    const effectiveGoals = goalRemaining[goalRemaining.length - 1]?.nextGoals || remote.goals;
    pendingCurrentTargetRef.current = 0;
    pendingGoalsRef.current = goalRemaining.length;
    setPendingMutations(remaining.length);
    monthRef.current = remote.month;
    goalsRef.current = effectiveGoals;
    setMonth(remote.month);
    setGoals(effectiveGoals);
    writeCachedMonth(householdStorageKey(householdId, currentMonthKey), remote.month);
    if (remaining.some((mutation) => mutation.lastError === 'conflict')) {
      setSyncState('conflict');
      setSyncError('Your local edit conflicts with a newer change from another device.');
    } else {
      setSyncState(remaining.length > 0 ? 'pending' : 'saved');
      setSyncError(null);
    }
  }, [user, workspaceId, workspace, currentMonthKey, householdId]);

  // Carry over recurring fixed expenses from previous month
  const carryOverRecurring = useCallback(
    async (monthKey: string) => {
      const [y, m] = monthKey.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      if (householdId || user) {
        const prev = householdId
          ? await getHouseholdMonthBudget(householdId, prevKey, budgetProfile)
          : user
            ? await getMonthBudget(user.uid, prevKey, budgetProfile)
            : undefined;
        if (prev) {
          const withCarry = carryOverFixedExpenses(month, prev);
          if (withCarry.fixedExpenses.length > month.fixedExpenses.length) {
            updateAndSaveMonth(withCarry, 'fixedBills');
          }
        }
      } else {
        try {
          const local = localStorage.getItem(`flousy_month_${prevKey}`);
          if (local) {
            const prev = normalizeMonth(JSON.parse(local), prevKey, budgetProfile);
            const withCarry = carryOverFixedExpenses(month, prev);
            if (withCarry.fixedExpenses.length > month.fixedExpenses.length) {
              updateAndSaveMonth(withCarry, 'fixedBills');
            }
          }
        } catch {
          /* ignore */
        }
      }
    },
    [month, budgetProfile, updateAndSaveMonth, user, householdId],
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
      (householdId
        ? fetchHouseholdMonthsForTrends(householdId, currentMonthKey, 6, profileRef.current)
        : fetchMonthsForTrends(user?.uid, currentMonthKey, 6, profileRef.current))
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
      const oldReceived = calculateReceivedIncome(month);
      const sources: IncomeSource[] = [{
        id: 'manual-total-income',
        templateId: 'manual-total-income',
        name: 'Primary Income',
        amount: safeBudget,
        status: 'paid',
        receivedAmount: safeBudget,
        receivedAt: new Date().toISOString(),
        recurring: true,
      }];
      const withCash = adjustPlaceBalance(month, 'bank', safeBudget - oldReceived);
      const updated = normalizeMonth(
        {
          ...withCash,
          totalBudget: safeBudget,
          incomeSources: sources,
          monthlySavingsTarget: calculateEnvelopeAmounts(safeBudget, month.strategyId, month.customRatios).savings,
        },
        currentMonthKey,
        budgetProfile,
      );

      updateAndSaveMonth(updated, 'balances');
      trackEvent('update_total_budget', { amount: safeBudget });
    },
    [month, currentMonthKey, budgetProfile, updateAndSaveMonth, mayWriteArea],
  );

  const handleEditMoneyPlaces = useCallback(
    (values: Record<string, number>, note?: string) => {
      if (!mayWriteArea('balances')) return;
      const updated = updateMoneyPlaces(month, values, {
        reason: 'reconciliation',
        note,
        createdByUserId: user?.uid,
      });
      updateAndSaveMonth(updated, 'balances');
    },
    [month, updateAndSaveMonth, user?.uid, mayWriteArea],
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
      if (!mayWriteArea('income')) return;
      const oldReceived = calculateReceivedIncome(month);
      const nextIncome = { totalBudget: total, incomeSources: sources };
      const receivedDelta = calculateReceivedIncome(nextIncome) - oldReceived;
      const withCash = adjustPlaceBalance(month, 'bank', receivedDelta);
      const updated = normalizeMonth(
        {
          ...withCash,
          incomeSources: sources,
          totalBudget: total,
          monthlySavingsTarget: calculateEnvelopeAmounts(total, month.strategyId, month.customRatios).savings,
        },
        currentMonthKey,
        budgetProfile,
      );
      updateAndSaveMonth(updated, 'income');
    },
    [month, currentMonthKey, budgetProfile, updateAndSaveMonth, mayWriteArea],
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
      updateAndSaveFinance(res.month, res.goals);
      trackEvent('edit_savings_entry', { type: patch.type });
    },
    [month, goals, updateAndSaveFinance, mayWriteArea],
  );

  const handleDeleteSavingsEntry = useCallback(
    (entryId: string) => {
      if (!mayWriteArea('savings')) return;
      const res = deleteSavingsActivityEntry(month, goals, entryId);
      updateAndSaveFinance(res.month, res.goals);
      trackEvent('delete_savings_entry', {});
    },
    [month, goals, updateAndSaveFinance, mayWriteArea],
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
    // CSV import can write either expense collection, so a read-only role must
    // never reach the importer even though it may separately export data.
    if (householdId && !canEditArea('expenses') && !canEditArea('fixedBills')) return;
    setIsCsvModalOpen(true);
  }, [householdId, canEditArea]);
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
      updateAndSaveFinance,
      syncState,
      syncError,
      pendingMutations,
      retrySync,
      discardPendingChanges,
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
      updateAndSaveFinance,
      syncState,
      syncError,
      pendingMutations,
      retrySync,
      discardPendingChanges,
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


