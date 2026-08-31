import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { DashboardScrollView as ScrollView } from '../../components/DashboardScrollView';
import { useRouter } from 'expo-router';
import Svg, { Rect, Circle, G, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import {
  calculateEnvelopeAmounts,
  calculateEnvelopeSpent,
  getDefaultCategoryNames,
  type MonthBudget,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { useMobileAuth } from '../../lib/auth-context';
import { getDemoMonthData } from '../../lib/storage';
import { getMonthBudget, getHouseholdMonthBudget } from '../../lib/db';

interface MonthStat {
  key: string;
  label: string;
  spent: number;
  income: number;
}

function getMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[m - 1] || key;
}

function getLastSixMonthKeys(currentKey: string): string[] {
  const [year, month] = currentKey.split('-').map(Number);
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    keys.push(`${yyyy}-${mm}`);
  }
  return keys;
}

export default function TrendsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, demoMode } = useMobileAuth();
  const {
    currentMonthKey,
    month,
    currency,
    scanUnlocked,
    workspace,
    updateProfile,
    household,
    profile,
  } = useMobileStore();
  const householdId =
    workspace === 'household' ? household?.id || profile?.activeHouseholdId : undefined;

  const [history, setHistory] = useState<MonthStat[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const variableExpenses = month?.variableExpenses || [];
  const fixedExpenses = month?.fixedExpenses || [];

  useEffect(() => {
    let active = true;
    async function loadSixMonths() {
      setLoadingHistory(true);
      const keys = getLastSixMonthKeys(currentMonthKey);
      const stats: MonthStat[] = [];

      for (const key of keys) {
        let m: MonthBudget | null = null;
        if (key === currentMonthKey && month) {
          m = month;
        } else if (demoMode) {
          const str = getDemoMonthData(key);
          if (str) {
            try {
              m = JSON.parse(str);
            } catch {
              m = null;
            }
          }
        } else if (user) {
          try {
            m = householdId
              ? await getHouseholdMonthBudget(householdId, key)
              : await getMonthBudget(user.uid, key);
          } catch {
            m = null;
          }
        }

        const spent = m
          ? (m.variableExpenses || []).reduce((a, e) => a + e.amount, 0) +
            (m.fixedExpenses || []).reduce((a, e) => a + e.amount, 0)
          : 0;
        const income = m?.totalBudget || 0;

        stats.push({
          key,
          label: getMonthLabel(key),
          spent,
          income,
        });
      }

      if (active) {
        setHistory(stats);
        setLoadingHistory(false);
      }
    }

    loadSixMonths();
    return () => {
      active = false;
    };
  }, [currentMonthKey, month, user, demoMode, householdId]);

  const totalSpent = useMemo(() => {
    const varTotal = variableExpenses.reduce((acc, e) => acc + e.amount, 0);
    const fixTotal = fixedExpenses.reduce((acc, e) => acc + e.amount, 0);
    return varTotal + fixTotal;
  }, [variableExpenses, fixedExpenses]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    variableExpenses.forEach((e) => {
      map[e.type] = (map[e.type] || 0) + e.amount;
    });
    fixedExpenses.forEach((e) => {
      map[e.type] = (map[e.type] || 0) + e.amount;
    });

    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return entries.map(([name, amount]) => {
      const pct = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
      return { name, amount, pct };
    });
  }, [variableExpenses, fixedExpenses, totalSpent]);

  const personBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    variableExpenses.forEach((e) => {
      const person = e.person || 'Personal / General';
      map[person] = (map[person] || 0) + e.amount;
    });
    fixedExpenses.forEach((e) => {
      const person = e.person || 'Personal / General';
      map[person] = (map[person] || 0) + e.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([person, amount]) => ({
        person,
        amount,
        pct: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
      }));
  }, [variableExpenses, fixedExpenses, totalSpent]);

  const envelopeSpent = month ? calculateEnvelopeSpent(month) : { needs: 0, wants: 0, savings: 0 };
  const envelopeCap = month
    ? calculateEnvelopeAmounts(month.totalBudget, month.strategyId, month.customRatios)
    : { needs: 0, wants: 0, savings: 0 };

  const savingsRate =
    month && month.totalBudget > 0
      ? Math.round(((month.totalBudget - totalSpent) / month.totalBudget) * 100)
      : 0;

  const maxHistorySpent = useMemo(() => {
    const max = Math.max(...history.map((h) => Math.max(h.spent, h.income)), 100);
    return max;
  }, [history]);

  if (!scanUnlocked) {
    return (
      <View className="flex-1 bg-neutral-100 dark:bg-neutral-900 items-center justify-center px-6">
        <Text className="text-xl font-bold text-neutral-900 dark:text-white text-center">
          Trends is a Pro feature
        </Text>
        <Text className="text-sm text-neutral-500 text-center mt-2 mb-5">
          Unlock analytics, or join a household workspace where Pro is shared.
        </Text>
        <Pressable
          onPress={() => updateProfile({ plan: 'pro' })}
          className="bg-primary px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">Unlock Pro (demo)</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/dashboard/settings')} className="mt-4">
          <Text className="text-primary font-bold">← Profile</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <View className="p-4 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <Pressable onPress={() => router.push('/dashboard/settings')} className="mb-2">
          <Text className="text-primary font-bold">← Profile</Text>
        </Pressable>
        <Text className="text-xl font-bold text-neutral-900 dark:text-white">
          Financial Trends & Analytics
        </Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          6-Month history, category distribution, household breakdown, and envelope health
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} className="space-y-6">
        {/* Summary Metric Card */}
        <View className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <Text className="text-xs font-semibold text-neutral-400 uppercase mb-1">
            Total Monthly Spending
          </Text>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-3xl font-extrabold text-neutral-900 dark:text-white">
              {totalSpent} <Text className="text-lg font-semibold">{currency}</Text>
            </Text>
            <View
              className={`px-3 py-1 rounded-full ${
                savingsRate >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  savingsRate >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {savingsRate >= 0 ? `+${savingsRate}% Savings Rate` : `${savingsRate}% Over Budget`}
              </Text>
            </View>
          </View>
        </View>

        {/* 6-MONTH SPENDING HISTORY CHART */}
        <View className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-base font-bold text-neutral-900 dark:text-white">
              6-Month Spending History
            </Text>
            {loadingHistory && <ActivityIndicator size="small" color="#2ea44f" />}
          </View>

          <View className="flex-row items-end justify-between h-40 pt-4 pb-2 border-b border-neutral-200 dark:border-neutral-700">
            {history.map((stat) => {
              const spentHeightPct = Math.max(8, Math.round((stat.spent / maxHistorySpent) * 100));
              const isCurrent = stat.key === currentMonthKey;
              return (
                <View key={stat.key} className="items-center flex-1">
                  <View className="w-8 h-28 justify-end items-center">
                    <View
                      style={{ height: `${spentHeightPct}%` }}
                      className={`w-5 rounded-t-lg ${
                        isCurrent ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-600'
                      }`}
                    />
                  </View>
                  <Text
                    className={`text-xs mt-2 font-semibold ${
                      isCurrent
                        ? 'text-primary font-bold'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {stat.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View className="flex-row justify-between pt-2">
            <Text className="text-xs text-neutral-400">Past 5 Months</Text>
            <Text className="text-xs font-bold text-primary">Current ({currentMonthKey})</Text>
          </View>
        </View>

        {/* CHART 1: Category Breakdown Bar Chart */}
        <View className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <Text className="text-base font-bold text-neutral-900 dark:text-white mb-4">
            Category Breakdown
          </Text>

          {categoryBreakdown.length === 0 ? (
            <Text className="text-sm text-neutral-400 text-center py-4">
              No spending recorded yet to generate charts.
            </Text>
          ) : (
            <View className="space-y-3">
              {categoryBreakdown.map((item, idx) => {
                const maxAmount = categoryBreakdown[0]?.amount || 1;
                const barWidth = Math.max(8, Math.round((item.amount / maxAmount) * 100));
                return (
                  <View key={item.name}>
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                        {idx + 1}. {item.name}
                      </Text>
                      <Text className="text-sm font-bold text-neutral-900 dark:text-white">
                        {item.amount} {currency} ({item.pct}%)
                      </Text>
                    </View>
                    <View className="h-2.5 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <View
                        style={{ width: `${barWidth}%` }}
                        className="h-full rounded-full bg-primary"
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* CHART 2: Envelope Shares Utilization */}
        <View className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <Text className="text-base font-bold text-neutral-900 dark:text-white mb-2">
            Envelope Utilization
          </Text>
          <Text className="text-xs text-neutral-400 mb-4">
            Needs (Blue) • Wants (Orange) • Savings (Green)
          </Text>

          <View className="flex-row h-6 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-700 mb-4">
            {month && month.totalBudget > 0 && (
              <>
                <View
                  style={{
                    width: `${Math.min(100, Math.max(5, (envelopeSpent.needs / month.totalBudget) * 100))}%`,
                  }}
                  className="bg-blue-600 h-full"
                />
                <View
                  style={{
                    width: `${Math.min(100, Math.max(5, (envelopeSpent.wants / month.totalBudget) * 100))}%`,
                  }}
                  className="bg-orange-500 h-full"
                />
                <View
                  style={{
                    width: `${Math.min(100, Math.max(5, (envelopeSpent.savings / month.totalBudget) * 100))}%`,
                  }}
                  className="bg-emerald-600 h-full"
                />
              </>
            )}
          </View>

          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-xs font-semibold text-blue-600">
                Needs: {envelopeSpent.needs} / {envelopeCap.needs} {currency}
              </Text>
              <Text className="text-xs font-bold text-blue-600">
                {envelopeCap.needs > 0 ? Math.round((envelopeSpent.needs / envelopeCap.needs) * 100) : 0}%
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs font-semibold text-orange-600">
                Wants: {envelopeSpent.wants} / {envelopeCap.wants} {currency}
              </Text>
              <Text className="text-xs font-bold text-orange-600">
                {envelopeCap.wants > 0 ? Math.round((envelopeSpent.wants / envelopeCap.wants) * 100) : 0}%
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs font-semibold text-emerald-600">
                Savings: {envelopeSpent.savings} / {envelopeCap.savings} {currency}
              </Text>
              <Text className="text-xs font-bold text-emerald-600">
                {envelopeCap.savings > 0 ? Math.round((envelopeSpent.savings / envelopeCap.savings) * 100) : 0}%
              </Text>
            </View>
          </View>
        </View>

        {/* CHART 3: Household / Person Spending Breakdown */}
        <View className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <Text className="text-base font-bold text-neutral-900 dark:text-white mb-4">
            Spending by Household Member
          </Text>

          {personBreakdown.length === 0 ? (
            <Text className="text-sm text-neutral-400 text-center py-4">
              No household member expenses assigned yet.
            </Text>
          ) : (
            <View className="space-y-3">
              {personBreakdown.map((item) => (
                <View
                  key={item.person}
                  className="flex-row justify-between items-center bg-neutral-50 dark:bg-neutral-750 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
                >
                  <View className="flex-row items-center space-x-2">
                    <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center">
                      <Text className="font-bold text-primary">
                        {item.person[0]?.toUpperCase() || 'P'}
                      </Text>
                    </View>
                    <Text className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {item.person}
                    </Text>
                  </View>
                  <Text className="font-bold text-neutral-900 dark:text-white">
                    {item.amount} {currency} ({item.pct}%)
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
