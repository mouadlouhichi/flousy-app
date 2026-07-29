import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  type MonthBudget,
  type SavingGoal,
  createNewMonth,
  normalizeMonth,
  carryOverFixedExpenses,
} from '@flousy/core';
import { useMobileAuth } from './auth-context';
import {
  getMonthBudget,
  saveMonthBudget,
  subscribeToMonth,
  getSavingsGoals,
  saveSavingsGoals as dbSaveSavingsGoals,
} from './db';
import {
  getDemoMonthData,
  saveDemoMonthData,
  getDemoSavingsData,
  saveDemoSavingsData,
} from './storage';

export interface MobileStoreContextType {
  currentMonthKey: string;
  month: MonthBudget | null;
  savingsGoals: SavingGoal[];
  loading: boolean;
  error: string | null;
  updateMonth: (newMonth: MonthBudget) => Promise<void>;
  updateSavingsGoals: (goals: SavingGoal[]) => Promise<void>;
  switchMonth: (monthKey: string) => void;
}

const MobileStoreContext = createContext<MobileStoreContextType | null>(null);

function getTodayMonthKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function getPreviousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 2, 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function MobileStoreProvider({ children }: { children: ReactNode }) {
  const { user, demoMode } = useMobileAuth();
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(getTodayMonthKey);
  const [month, setMonth] = useState<MonthBudget | null>(null);
  const [savingsGoals, setSavingsGoalsState] = useState<SavingGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        if (user && !demoMode) {
          // Load savings goals from Firestore
          const goals = await getSavingsGoals(user.uid);
          if (active) setSavingsGoalsState(goals);

          // Subscribe to live month doc
          unsubscribe = subscribeToMonth(
            user.uid,
            currentMonthKey,
            async (liveMonth) => {
              if (!active) return;
              if (liveMonth) {
                setMonth(liveMonth);
                setLoading(false);
              } else {
                // Initialize default month if missing and carry over fixed bills
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
          // Load demo savings goals from MMKV
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

          // Load demo month from MMKV
          const savedMonthStr = getDemoMonthData(currentMonthKey);
          if (savedMonthStr) {
            try {
              const parsed = normalizeMonth(JSON.parse(savedMonthStr), currentMonthKey);
              if (active) setMonth(parsed);
            } catch {
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
  }, [user, demoMode, currentMonthKey]);

  const updateMonth = useCallback(
    async (newMonth: MonthBudget) => {
      setMonth(newMonth);
      if (user && !demoMode) {
        await saveMonthBudget(user.uid, currentMonthKey, newMonth);
      } else if (demoMode) {
        saveDemoMonthData(currentMonthKey, JSON.stringify(newMonth));
      }
    },
    [user, demoMode, currentMonthKey]
  );

  const updateSavingsGoals = useCallback(
    async (goals: SavingGoal[]) => {
      setSavingsGoalsState(goals);
      if (user && !demoMode) {
        await dbSaveSavingsGoals(user.uid, goals);
      } else if (demoMode) {
        saveDemoSavingsData(JSON.stringify(goals));
      }
    },
    [user, demoMode]
  );

  const switchMonth = useCallback((monthKey: string) => {
    setCurrentMonthKey(monthKey);
  }, []);

  return (
    <MobileStoreContext.Provider
      value={{
        currentMonthKey,
        month,
        savingsGoals,
        loading,
        error,
        updateMonth,
        updateSavingsGoals,
        switchMonth,
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
