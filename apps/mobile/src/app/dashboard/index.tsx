import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  STRATEGIES,
  calculateEnvelopeAmounts,
  calculateEnvelopeSpent,
  type MoneyPlace,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { useMobileAuth } from '../../lib/auth-context';
import { useBudgetNotifications } from '../../hooks/useBudgetNotifications';
import { MoveMoneyModal } from '../../components/MoveMoneyModal';

const DEFAULT_CURRENCY = 'MAD';

export default function DashboardOverviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, demoMode, signOut, sendEmailVerification } = useMobileAuth();
  const { currentMonthKey, month, loading, error, updateMonth, switchMonth } = useMobileStore();

  const [moveModalVisible, setMoveModalVisible] = useState(false);

  const currency = DEFAULT_CURRENCY;

  useBudgetNotifications(month, currency);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator size="large" color="#2ea44f" />
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

  const strategy = STRATEGIES[month.strategyId] || STRATEGIES['50-30-20'];
  const { needs: needsCap, wants: wantsCap, savings: savingsCap } =
    calculateEnvelopeAmounts(month.totalBudget, month.strategyId);
  const spent = calculateEnvelopeSpent(month);

  const totalCash = (month.bankPart || 0) + (month.homePart || 0) + (month.walletPart || 0);

  const needsSpentPct = needsCap > 0 ? Math.min(100, Math.round((spent.needs / needsCap) * 100)) : 0;
  const wantsSpentPct = wantsCap > 0 ? Math.min(100, Math.round((spent.wants / wantsCap) * 100)) : 0;
  const savingsSpentPct =
    savingsCap > 0 ? Math.min(100, Math.round((spent.savings / savingsCap) * 100)) : 0;

  const handlePrevMonth = () => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    switchMonth(`${yyyy}-${mm}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const d = new Date(y, m, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    switchMonth(`${yyyy}-${mm}`);
  };

  const handleMoveMoney = async (from: MoneyPlace, to: MoneyPlace, amount: number) => {
    const fromVal = month[from === 'bank' ? 'bankPart' : from === 'home' ? 'homePart' : 'walletPart'] || 0;
    const toVal = month[to === 'bank' ? 'bankPart' : to === 'home' ? 'homePart' : 'walletPart'] || 0;

    const actualAmount = Math.min(amount, fromVal);
    const nextMonth = {
      ...month,
      [from === 'bank' ? 'bankPart' : from === 'home' ? 'homePart' : 'walletPart']: Math.max(
        0,
        fromVal - actualAmount
      ),
      [to === 'bank' ? 'bankPart' : to === 'home' ? 'homePart' : 'walletPart']:
        toVal + actualAmount,
    };
    await updateMonth(nextMonth);
  };

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} className="px-4 pt-4">
        {/* Header Bar */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center space-x-2">
            <Pressable
              onPress={handlePrevMonth}
              className="p-2 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              <Text className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                ←
              </Text>
            </Pressable>
            <Text className="text-lg font-bold text-neutral-900 dark:text-white">
              {currentMonthKey}
            </Text>
            <Pressable
              onPress={handleNextMonth}
              className="p-2 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              <Text className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                →
              </Text>
            </Pressable>
          </View>

          <View className="flex-row items-center space-x-2">
            {demoMode && (
              <View className="bg-amber-100 dark:bg-amber-900/50 px-2.5 py-1 rounded-full border border-amber-300">
                <Text className="text-xs font-bold text-amber-800 dark:text-amber-200">
                  Demo
                </Text>
              </View>
            )}
            <Pressable
              onPress={async () => {
                await signOut();
                router.replace('/login');
              }}
              className="bg-white dark:bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              <Text className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Exit
              </Text>
            </Pressable>
          </View>
        </View>

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

        {/* Strategy Summary Card */}
        <View className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 mb-6 shadow-sm">
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
        </View>

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

          <View className="flex-row space-x-2">
            {/* Bank */}
            <View className="flex-1 bg-white dark:bg-neutral-800 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-700">
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                Bank Account
              </Text>
              <Text className="text-base font-bold text-neutral-900 dark:text-white">
                {month.bankPart || 0}
              </Text>
              <Text className="text-xs text-neutral-400">{currency}</Text>
            </View>

            {/* Home */}
            <View className="flex-1 bg-white dark:bg-neutral-800 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-700">
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                Home Cash
              </Text>
              <Text className="text-base font-bold text-neutral-900 dark:text-white">
                {month.homePart || 0}
              </Text>
              <Text className="text-xs text-neutral-400">{currency}</Text>
            </View>

            {/* Wallet */}
            <View className="flex-1 bg-white dark:bg-neutral-800 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-700">
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                Wallet
              </Text>
              <Text className="text-base font-bold text-neutral-900 dark:text-white">
                {month.walletPart || 0}
              </Text>
              <Text className="text-xs text-neutral-400">{currency}</Text>
            </View>
          </View>

          <View className="mt-3 bg-neutral-200/50 dark:bg-neutral-800/50 px-4 py-2.5 rounded-xl flex-row justify-between items-center">
            <Text className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Total Physical Cash Available:
            </Text>
            <Text className="text-sm font-bold text-neutral-900 dark:text-white">
              {totalCash} {currency}
            </Text>
          </View>
        </View>
      </ScrollView>

      <MoveMoneyModal
        visible={moveModalVisible}
        onClose={() => setMoveModalVisible(false)}
        month={month}
        currency={currency}
        onConfirm={handleMoveMoney}
      />
    </View>
  );
}
