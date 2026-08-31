import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  addFixedExpense,
  addVariableExpense,
  calculateEnvelopeAmounts,
  calculateEnvelopeSpent,
  calculateMonthlyDepositedSavings,
  formatShortDate,
  getPlaceBalance,
  moveMoney,
  resolveMonthStrategy,
  saveGoalWithBalance,
  totalCashOnHand,
  type FixedExpense,
  type MoneyPlace,
  type SavingGoal,
  type VariableExpense,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { useMobileAuth } from '../../lib/auth-context';
import { useBudgetNotifications } from '../../hooks/useBudgetNotifications';
import { MoveMoneyModal } from '../../components/MoveMoneyModal';
import { StrategyModal } from '../../components/StrategyModal';
import { ExpenseModal } from '../../components/ExpenseModal';
import { FixedModal } from '../../components/FixedModal';
import { SavingsGoalModal } from '../../components/SavingsModal';
import { getMobileQuickActions } from '@flousy/core';

export default function DashboardOverviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, demoMode, sendEmailVerification } = useMobileAuth();
  const {
    currentMonthKey,
    month,
    loading,
    updateMonth,
    currency,
    moneyPlaces,
    workspace,
    canEditArea,
    savingsGoals,
    updateSavingsGoals,
  } = useMobileStore();

  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [strategyVisible, setStrategyVisible] = useState(false);
  const [expenseVisible, setExpenseVisible] = useState(false);
  const [fixedVisible, setFixedVisible] = useState(false);
  const [savingsVisible, setSavingsVisible] = useState(false);

  useBudgetNotifications(month, currency);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator size="large" color="#026462" />
      </View>
    );
  }

  if (!month) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900 px-6">
        <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center mb-4">
          No month budget found for {currentMonthKey}.
        </Text>
        <Pressable
          onPress={() => router.push('/onboarding')}
          className="bg-primary px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Start Setup</Text>
        </Pressable>
      </View>
    );
  }

  const strategy = resolveMonthStrategy(month);
  const { needs: needsCap, wants: wantsCap, savings: savingsCap } =
    calculateEnvelopeAmounts(month.totalBudget, month.strategyId, month.customRatios);
  const spent = calculateEnvelopeSpent(month);
  const depositedThisMonth = calculateMonthlyDepositedSavings(month);

  const totalCash = totalCashOnHand(month);
  const quickActions = getMobileQuickActions();

  const needsSpentPct = needsCap > 0 ? Math.min(100, Math.round((spent.needs / needsCap) * 100)) : 0;
  const wantsSpentPct = wantsCap > 0 ? Math.min(100, Math.round((spent.wants / wantsCap) * 100)) : 0;
  const savingsSpentPct =
    savingsCap > 0 ? Math.min(100, Math.round((spent.savings / savingsCap) * 100)) : 0;

  const handleMoveMoney = async (from: MoneyPlace, to: MoneyPlace, amount: number) => {
    await updateMonth(moveMoney(month, from, to, amount));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View className="flex-1 bg-[#F5FAF8] dark:bg-neutral-900">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} className="px-4 pt-4">
        {/* Email Unverified Banner */}
        {user && !user.emailVerified && !demoMode && (
          <View className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-2xl border border-amber-300 dark:border-amber-700 mb-6 flex-row items-center justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-xs font-bold text-amber-800 dark:text-amber-200">
                Email Unverified
              </Text>
              <Text className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Verify your email address to secure your account.
              </Text>
            </View>
            <Pressable
              onPress={async () => {
                await sendEmailVerification();
                Alert.alert('Sent', 'Verification email sent!');
              }}
              className="bg-amber-600 px-3 py-2 rounded-xl"
            >
              <Text className="text-xs font-bold text-white">Resend</Text>
            </Pressable>
          </View>
        )}

        {workspace === 'household' && (
          <View className="bg-primary/10 px-3 py-2 rounded-xl mb-4">
            <Text className="text-xs font-bold text-primary">Household workspace</Text>
          </View>
        )}

        <View className="flex-row flex-wrap gap-2 mb-4">
          {quickActions.map((action) => (
            <Pressable
              key={action.id}
              onPress={() => {
                if (action.id === 'courses') router.push('/dashboard/courses');
                else if (action.id === 'expense' && canEditArea('expenses')) setExpenseVisible(true);
                else if (action.id === 'charge' && canEditArea('fixedBills')) setFixedVisible(true);
                else if (action.id === 'savings' && canEditArea('savings')) setSavingsVisible(true);
              }}
              className="bg-white dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700"
            >
              <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{action.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Strategy Summary Card */}
        <Pressable
          onPress={() => setStrategyVisible(true)}
          className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 mb-6 shadow-sm"
        >
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">
              Strategy: {strategy.name}
            </Text>
            <Text className="text-sm font-bold text-primary">
              {month.totalBudget} {currency}
            </Text>
          </View>
          <Text className="text-xs text-neutral-400 dark:text-neutral-500">
            {strategy.description}
          </Text>
          <Text className="text-xs text-primary font-semibold mt-2">Tap to change · includes custom split</Text>
        </Pressable>

        {/* AXIS 1: Budget Envelopes (What money is FOR) */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold text-neutral-900 dark:text-white">
              Budget Envelopes (What it's FOR)
            </Text>
            <Text className="text-xs font-semibold text-neutral-500">
              Needs / Wants / Savings
            </Text>
          </View>

          <View className="space-y-3">
            {/* Needs */}
            <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700">
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-sm font-bold text-blue-600">Needs Envelope</Text>
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">
                  {spent.needs} / {needsCap} {currency}
                </Text>
              </View>
              <View className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                <View
                  style={{ width: `${needsSpentPct}%` }}
                  className={`h-full rounded-full ${
                    needsSpentPct >= 100 ? 'bg-red-500' : 'bg-blue-600'
                  }`}
                />
              </View>
              <Text className="text-xs text-neutral-400 mt-1">
                {needsSpentPct}% of Needs budget used
              </Text>
            </View>

            {/* Wants */}
            <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700">
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-sm font-bold text-orange-600">Wants Envelope</Text>
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">
                  {spent.wants} / {wantsCap} {currency}
                </Text>
              </View>
              <View className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                <View
                  style={{ width: `${wantsSpentPct}%` }}
                  className={`h-full rounded-full ${
                    wantsSpentPct >= 100 ? 'bg-red-500' : 'bg-orange-500'
                  }`}
                />
              </View>
              <Text className="text-xs text-neutral-400 mt-1">
                {wantsSpentPct}% of Wants budget used
              </Text>
            </View>

            {/* Savings */}
            <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700">
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-sm font-bold text-emerald-600">
                  Savings Envelope
                </Text>
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">
                  {spent.savings} / {savingsCap} {currency}
                </Text>
              </View>
              <View className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                <View
                  style={{ width: `${savingsSpentPct}%` }}
                  className="h-full rounded-full bg-emerald-600"
                />
              </View>
              <Text className="text-xs text-neutral-400 mt-1">
                {savingsSpentPct}% allocated to savings
              </Text>
            </View>
          </View>
        </View>

        {/* AXIS 2: Money Places (Where money IS) */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold text-neutral-900 dark:text-white">
              Money Places (Where it IS)
            </Text>
            <Pressable
              onPress={() => setMoveModalVisible(true)}
              className="bg-primary/15 px-3 py-1.5 rounded-lg border border-primary/30"
            >
              <Text className="text-xs font-bold text-primary">Move Money ⇄</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1">
            <View className="flex-row gap-2">
              {moneyPlaces.map((place) => (
                <View
                  key={place.id}
                  className="w-32 bg-white dark:bg-neutral-800 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-700"
                >
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                    {place.name}
                  </Text>
                  <Text className="text-base font-bold text-neutral-900 dark:text-white">
                    {getPlaceBalance(month, place.id)}
                  </Text>
                  <Text className="text-xs text-neutral-400">{currency}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View className="mt-3 bg-neutral-200/50 dark:bg-neutral-800/50 px-4 py-2.5 rounded-xl flex-row justify-between items-center">
            <Text className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Total Physical Cash Available:
            </Text>
            <Text className="text-sm font-bold text-neutral-900 dark:text-white">
              {totalCash} {currency}
            </Text>
          </View>
        </View>

        <View className="mb-6">
          <Text className="text-base font-bold text-neutral-900 dark:text-white mb-2">
            Savings this month
          </Text>
          <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <Text className="text-sm text-neutral-500">Deposited (net)</Text>
            <Text className="text-lg font-bold text-emerald-600">
              {depositedThisMonth} {currency}
            </Text>
            {(month.savingsActivity || []).slice(0, 5).map((evt) => (
              <View key={evt.id} className="flex-row justify-between mt-2">
                <Text className="text-xs text-neutral-600 dark:text-neutral-300">
                  {evt.type === 'deposit' ? '+' : '−'} {evt.goalName}
                </Text>
                <Text className="text-xs text-neutral-500">
                  {evt.amount} · {formatShortDate(evt.date)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <MoveMoneyModal
        visible={moveModalVisible}
        onClose={() => setMoveModalVisible(false)}
        month={month}
        currency={currency}
        places={moneyPlaces}
        onConfirm={handleMoveMoney}
      />
      <StrategyModal
        visible={strategyVisible}
        onClose={() => setStrategyVisible(false)}
        month={month}
        onUpdateMonth={updateMonth}
      />
      <ExpenseModal
        visible={expenseVisible}
        onClose={() => setExpenseVisible(false)}
        month={month}
        currency={currency}
        onSave={async (expense: VariableExpense) => {
          await updateMonth(addVariableExpense(month, expense));
        }}
      />
      <FixedModal
        visible={fixedVisible}
        onClose={() => setFixedVisible(false)}
        month={month}
        currency={currency}
        onSave={async (expense: FixedExpense) => {
          await updateMonth(addFixedExpense(month, expense));
        }}
      />
      <SavingsGoalModal
        visible={savingsVisible}
        onClose={() => setSavingsVisible(false)}
        currency={currency}
        onSave={async (goal: SavingGoal, deductFromPlace) => {
          const res = saveGoalWithBalance(month, savingsGoals, goal, deductFromPlace ?? null);
          await updateMonth(res.month);
          await updateSavingsGoals(res.goals);
        }}
      />
    </View>
  );
}
