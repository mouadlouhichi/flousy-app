import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  type MonthBudget,
  type SavingGoal,
  type UserProfile,
  type MoneyPlaceConfig,
  type Household,
  type HouseholdMember,
  type HouseholdInvite,
  type HouseholdInvoice,
  createNewMonth,
  normalizeMonth,
  carryOverFixedExpenses,
  resolveMoneyPlaces,
  getCurrentMonthKey,
  isProUser,
  isProFeatureUnlocked,
  actorForMonth,
  canEdit,
  type HouseholdArea,
} from '@flousy/core';
import { useMobileAuth } from './auth-context';
import {
  getMonthBudget,
  saveMonthBudget,
  subscribeToMonth,
  getSavingsGoals,
  saveSavingsGoals as dbSaveSavingsGoals,
  getUserProfile,
  setUserProfile as dbSetUserProfile,
  subscribeHousehold,
  subscribeHouseholdMembers,
  subscribeHouseholdMonthBudget,
  saveHouseholdMonthBudget,
  getHouseholdMonthBudget,
  subscribeHouseholdSavingsGoals,
  saveHouseholdSavingsGoals,
  subscribePendingHouseholdInvites,
  acceptHouseholdInvite,
  subscribeHouseholdInvoices,
} from './db';
import {
  getDemoMonthData,
  saveDemoMonthData,
  getDemoSavingsData,
  saveDemoSavingsData,
  DEMO_PROFILE_KEY,
  PRO_PLAN_KEY,
  CURRENCY_STORAGE_KEY,
  getJson,
  setJson,
  storage,
} from './storage';

export type WorkspaceKind = 'personal' | 'household';

export interface MobileStoreContextType {
  currentMonthKey: string;
  month: MonthBudget | null;
  savingsGoals: SavingGoal[];
  profile: UserProfile | null;
  moneyPlaces: MoneyPlaceConfig[];
  loading: boolean;
  error: string | null;
  isPro: boolean;
  scanUnlocked: boolean;
  workspace: WorkspaceKind;
  household: Household | null;
  householdMembers: HouseholdMember[];
  pendingInvites: HouseholdInvite[];
  invoices: HouseholdInvoice[];
  currency: string;
  updateMonth: (newMonth: MonthBudget) => Promise<void>;
  updateSavingsGoals: (goals: SavingGoal[]) => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  switchMonth: (monthKey: string) => void;
  setWorkspace: (kind: WorkspaceKind) => Promise<void>;
  acceptInvite: (invite: HouseholdInvite) => Promise<void>;
  currentMember: HouseholdMember | null;
  canEditArea: (area: HouseholdArea, own?: boolean) => boolean;
}

const MobileStoreContext = createContext<MobileStoreContextType | null>(null);

function getPreviousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 2, 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function defaultProfile(): UserProfile {
  return {
    plan: storage.getString(PRO_PLAN_KEY) === 'true' ? 'pro' : 'free',
    currency: storage.getString(CURRENCY_STORAGE_KEY) || 'MAD',
    onboardingComplete: true,
  };
}

export function MobileStoreProvider({ children }: { children: ReactNode }) {
  const { user, demoMode } = useMobileAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(() => getCurrentMonthKey(undefined));
  const [month, setMonth] = useState<MonthBudget | null>(null);
  const [savingsGoals, setSavingsGoalsState] = useState<SavingGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspaceState] = useState<WorkspaceKind>('personal');
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<HouseholdInvite[]>([]);
  const [invoices, setInvoices] = useState<HouseholdInvoice[]>([]);

  const householdId = workspace === 'household' ? profile?.activeHouseholdId : undefined;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (user && !demoMode) {
        const remote = await getUserProfile(user.uid);
        if (!active) return;
        const next = remote || defaultProfile();
        setProfile(next);
        setWorkspaceState(next.activeWorkspace === 'household' && next.activeHouseholdId ? 'household' : 'personal');
        setCurrentMonthKey(getCurrentMonthKey(next.monthStartDate));
      } else if (demoMode) {
        const stored = getJson<UserProfile | null>(DEMO_PROFILE_KEY, null) || defaultProfile();
        setProfile(stored);
        setCurrentMonthKey(getCurrentMonthKey(stored.monthStartDate));
      } else {
        setProfile(null);
      }
    }
    loadProfile();
    return () => {
      active = false;
    };
  }, [user, demoMode]);

  useEffect(() => {
    if (!user || demoMode) {
      setPendingInvites([]);
      return;
    }
    return subscribePendingHouseholdInvites(user.email, setPendingInvites);
  }, [user, demoMode]);

  useEffect(() => {
    if (!householdId || demoMode) {
      setHousehold(null);
      setHouseholdMembers([]);
      setInvoices([]);
      return;
    }
    const unsubH = subscribeHousehold(householdId, setHousehold);
    const unsubM = subscribeHouseholdMembers(householdId, setHouseholdMembers);
    const unsubI = subscribeHouseholdInvoices(householdId, setInvoices);
    return () => {
      unsubH();
      unsubM();
      unsubI();
    };
  }, [householdId, demoMode]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const usingHousehold = Boolean(householdId) && !demoMode && user;

        if (user && !demoMode && usingHousehold && householdId) {
          const unsubGoals = subscribeHouseholdSavingsGoals(householdId, (goals) => {
            if (active) setSavingsGoalsState(goals);
          });
          unsubscribe = subscribeHouseholdMonthBudget(householdId, currentMonthKey, async (liveMonth) => {
            if (!active) return;
            if (liveMonth) {
              setMonth(liveMonth);
              setLoading(false);
            } else {
              const initialMonth = createNewMonth(0, '50-30-20', [], [], currentMonthKey);
              const prevKey = getPreviousMonthKey(currentMonthKey);
              const prevMonth = await getHouseholdMonthBudget(householdId, prevKey);
              const withCarry = prevMonth ? carryOverFixedExpenses(initialMonth, prevMonth) : initialMonth;
              await saveHouseholdMonthBudget(householdId, currentMonthKey, withCarry);
              if (active) {
                setMonth(withCarry);
                setLoading(false);
              }
            }
          });
          const prevUnsub = unsubscribe;
          unsubscribe = () => {
            unsubGoals();
            prevUnsub();
          };
        } else if (user && !demoMode) {
          const goals = await getSavingsGoals(user.uid);
          if (active) setSavingsGoalsState(goals);

          unsubscribe = subscribeToMonth(
            user.uid,
            currentMonthKey,
            async (liveMonth) => {
              if (!active) return;
              if (liveMonth) {
                setMonth(liveMonth);
                setLoading(false);
              } else {
                const initialMonth = createNewMonth(0, '50-30-20', [], [], currentMonthKey);
                const prevKey = getPreviousMonthKey(currentMonthKey);
                const prevMonth = await getMonthBudget(user.uid, prevKey);
                const withCarry = prevMonth
                  ? carryOverFixedExpenses(initialMonth, prevMonth)
                  : initialMonth;
                await saveMonthBudget(user.uid, currentMonthKey, withCarry);
                if (active) {
                  setMonth(withCarry);
                  setLoading(false);
                }
              }
            },
            (err) => {
              if (active) {
                setError(err.message);
                setLoading(false);
              }
            }
          );
        } else if (demoMode) {
          const savedGoalsStr = getDemoSavingsData();
          if (savedGoalsStr) {
            try {
              setSavingsGoalsState(JSON.parse(savedGoalsStr));
            } catch {
              setSavingsGoalsState([]);
            }
          } else {
            setSavingsGoalsState([]);
          }

          const savedMonthStr = getDemoMonthData(currentMonthKey);
          if (savedMonthStr) {
            try {
              const parsed = normalizeMonth(JSON.parse(savedMonthStr), currentMonthKey, profileRef.current ?? undefined);
              if (active) setMonth(parsed);
            } catch {
              const initialMonth = createNewMonth(0, '50-30-20', [], [], currentMonthKey);
              saveDemoMonthData(currentMonthKey, JSON.stringify(initialMonth));
              if (active) setMonth(initialMonth);
            }
          } else {
            const initialMonth = createNewMonth(0, '50-30-20', [], [], currentMonthKey);
            const prevKey = getPreviousMonthKey(currentMonthKey);
            const prevStr = getDemoMonthData(prevKey);
            let withCarry = initialMonth;
            if (prevStr) {
              try {
                const prevParsed = normalizeMonth(JSON.parse(prevStr), prevKey);
                withCarry = carryOverFixedExpenses(initialMonth, prevParsed);
              } catch {
                withCarry = initialMonth;
              }
            }
            saveDemoMonthData(currentMonthKey, JSON.stringify(withCarry));
            if (active) setMonth(withCarry);
          }
          if (active) setLoading(false);
        } else {
          if (active) {
            setMonth(null);
            setLoading(false);
          }
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Failed to load month data');
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user, demoMode, currentMonthKey, householdId]);

  const updateMonth = useCallback(
    async (newMonth: MonthBudget) => {
      const stamped = actorForMonth(newMonth, user?.uid);
      setMonth(stamped);
      if (user && !demoMode && householdId) {
        await saveHouseholdMonthBudget(householdId, currentMonthKey, stamped);
      } else if (user && !demoMode) {
        await saveMonthBudget(user.uid, currentMonthKey, stamped);
      } else if (demoMode) {
        saveDemoMonthData(currentMonthKey, JSON.stringify(stamped));
      }
    },
    [user, demoMode, currentMonthKey, householdId]
  );

  const updateSavingsGoals = useCallback(
    async (goals: SavingGoal[]) => {
      setSavingsGoalsState(goals);
      if (user && !demoMode && householdId) {
        await saveHouseholdSavingsGoals(householdId, goals);
      } else if (user && !demoMode) {
        await dbSaveSavingsGoals(user.uid, goals);
      } else if (demoMode) {
        saveDemoSavingsData(JSON.stringify(goals));
      }
    },
    [user, demoMode, householdId]
  );

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      const next = { ...(profile || defaultProfile()), ...patch };
      setProfile(next);
      if (patch.currency) storage.set(CURRENCY_STORAGE_KEY, patch.currency);
      if (patch.plan === 'pro') storage.set(PRO_PLAN_KEY, 'true');
      if (user && !demoMode) {
        await dbSetUserProfile(user.uid, patch);
      } else {
        setJson(DEMO_PROFILE_KEY, next);
      }
      if (patch.monthStartDate) {
        setCurrentMonthKey(getCurrentMonthKey(patch.monthStartDate));
      }
    },
    [profile, user, demoMode]
  );

  const switchMonth = useCallback((monthKey: string) => {
    setCurrentMonthKey(monthKey);
  }, []);

  const setWorkspace = useCallback(
    async (kind: WorkspaceKind) => {
      setWorkspaceState(kind);
      await updateProfile({ activeWorkspace: kind });
    },
    [updateProfile]
  );

  const acceptInvite = useCallback(
    async (invite: HouseholdInvite) => {
      if (!user) return;
      await acceptHouseholdInvite(invite, user.uid, user.displayName || user.email || 'Member');
      const ids = Array.from(new Set([...(profile?.householdIds || []), invite.householdId]));
      await updateProfile({
        activeHouseholdId: invite.householdId,
        activeWorkspace: 'household',
        householdIds: ids,
      });
      setWorkspaceState('household');
    },
    [user, profile, updateProfile]
  );

  const isPro = isProUser(profile, {
    getItem: (key: string) => storage.getString(key) ?? null,
  });
  const scanUnlocked = isProFeatureUnlocked(isPro, workspace);
  const moneyPlaces = resolveMoneyPlaces(profile);
  const currency = profile?.currency || storage.getString(CURRENCY_STORAGE_KEY) || 'MAD';
  const currentMember =
    householdMembers.find((m) => m.userId === user?.uid || m.id === user?.uid) || null;
  const canEditArea = (area: HouseholdArea, own = true) => {
    if (workspace !== 'household') return true;
    return canEdit(currentMember?.role, area, currentMember?.permissions, own);
  };

  return (
    <MobileStoreContext.Provider
      value={{
        currentMonthKey,
        month,
        savingsGoals,
        profile,
        moneyPlaces,
        loading,
        error,
        isPro,
        scanUnlocked,
        workspace,
        household,
        householdMembers,
        pendingInvites,
        invoices,
        currency,
        updateMonth,
        updateSavingsGoals,
        updateProfile,
        switchMonth,
        setWorkspace,
        acceptInvite,
        currentMember,
        canEditArea,
      }}
    >
      {children}
    </MobileStoreContext.Provider>
  );
}

export function useMobileStore(): MobileStoreContextType {
  const context = useContext(MobileStoreContext);
  if (!context) {
    throw new Error('useMobileStore must be used within a MobileStoreProvider');
  }
  return context;
}
