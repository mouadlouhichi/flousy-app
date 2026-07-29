import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  STRATEGIES,
  type StrategyId,
  type MonthBudget,
  createNewMonth,
  calculateEnvelopeAmounts,
  getDefaultCategoryNames,
} from '@flousy/core';
import { useMobileAuth } from '../../lib/auth-context';
import { saveMonthBudget, setUserProfile } from '../../lib/db';
import { saveDemoMonthData } from '../../lib/storage';

function getTodayMonthKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

const DEFAULT_CURRENCY = 'MAD';

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, demoMode } = useMobileAuth();

  const [step, setStep] = useState(1);
  const [income, setIncome] = useState('15000');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [strategyId, setStrategyId] = useState<StrategyId>('50-30-20');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    getDefaultCategoryNames(i18n.language as any).slice(0, 6)
  );
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [bills, setBills] = useState<{ name: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const allCategories = getDefaultCategoryNames(i18n.language as any);
  const numericIncome = Math.max(0, parseFloat(income) || 0);

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories((prev) => prev.filter((c) => c !== cat));
    } else {
      setSelectedCategories((prev) => [...prev, cat]);
    }
  };

  const handleAddBill = () => {
    const amt = parseFloat(billAmount);
    if (!billName.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Bill', 'Please enter a valid bill name and amount.');
      return;
    }
    setBills((prev) => [...prev, { name: billName.trim(), amount: amt }]);
    setBillName('');
    setBillAmount('');
  };

  const handleRemoveBill = (index: number) => {
    setBills((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFinish = async () => {
    setLoading(true);
    const monthKey = getTodayMonthKey();
    const initialMonth: MonthBudget = createNewMonth(
      numericIncome,
      strategyId,
      selectedCategories,
      bills.map((b) => ({ name: b.name, amount: b.amount, category: 'needs' })),
      monthKey
    );
    initialMonth.bankPart = numericIncome;
    initialMonth.homePart = 0;
    initialMonth.walletPart = 0;

    try {
      if (user && !demoMode) {
        await Promise.all([
          saveMonthBudget(user.uid, monthKey, initialMonth),
          setUserProfile(user.uid, { currency, onboardingComplete: true }),
        ]);
      } else if (demoMode) {
        saveDemoMonthData(monthKey, JSON.stringify(initialMonth));
      }
      router.replace('/dashboard');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save setup');
    } finally {
      setLoading(false);
    }
  };

  const strategy = STRATEGIES[strategyId];
  const envelopeAmounts = calculateEnvelopeAmounts(numericIncome, strategyId);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-neutral-900"
    >
      <View className="pt-14 px-6 pb-4 border-b border-neutral-200 dark:border-neutral-800 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
          Step {step} of 5
        </Text>
        <Text className="text-sm font-semibold text-primary">Flousy Setup</Text>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-6">
        {step === 1 && (
          <View className="space-y-6">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              What is your typical monthly income?
            </Text>
            <Text className="text-neutral-500 dark:text-neutral-400 text-sm mb-4">
              We use this to calibrate your needs, wants, and savings envelopes.
            </Text>
            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Monthly Income
              </Text>
              <TextInput
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold text-lg"
                keyboardType="numeric"
                value={income}
                onChangeText={setIncome}
              />
            </View>
          </View>
        )}

        {step === 2 && (
          <View className="space-y-6">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              Select your active categories
            </Text>
            <Text className="text-neutral-500 dark:text-neutral-400 text-sm mb-4">
              Tap categories you regularly track. You can add custom categories anytime.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {allCategories.map((cat) => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <Pressable
                    key={cat}
                    onPress={() => toggleCategory(cat)}
                    className={`px-4 py-2.5 rounded-xl border ${
                      isSelected
                        ? 'bg-primary border-primary'
                        : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        isSelected ? 'text-white' : 'text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {step === 3 && (
          <View className="space-y-6">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              Add recurring monthly bills
            </Text>
            <Text className="text-neutral-500 dark:text-neutral-400 text-sm mb-4">
              Fixed bills like rent, subscriptions, or utilities carry over automatically each month.
            </Text>
            <View className="flex-row space-x-2">
              <TextInput
                className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
                placeholder="Bill Name (e.g. Rent)"
                placeholderTextColor="#9ca3af"
                value={billName}
                onChangeText={setBillName}
              />
              <TextInput
                className="w-24 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
                placeholder="Amount"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={billAmount}
                onChangeText={setBillAmount}
              />
            </View>
            <Pressable
              onPress={handleAddBill}
              className="bg-neutral-800 dark:bg-neutral-700 py-3 rounded-xl items-center"
            >
              <Text className="text-white font-medium text-sm">+ Add Bill</Text>
            </Pressable>

            {bills.map((b, i) => (
              <View
                key={i}
                className="flex-row justify-between items-center bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
              >
                <Text className="text-neutral-800 dark:text-neutral-200 font-medium">
                  {b.name}
                </Text>
                <View className="flex-row items-center space-x-4">
                  <Text className="text-neutral-600 dark:text-neutral-400 font-semibold">
                    {b.amount} {currency}
                  </Text>
                  <Pressable onPress={() => handleRemoveBill(i)}>
                    <Text className="text-red-500 font-bold text-sm">Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {step === 4 && (
          <View className="space-y-6">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              Choose your budgeting strategy
            </Text>
            <Text className="text-neutral-500 dark:text-neutral-400 text-sm mb-4">
              Your strategy divides income into Needs, Wants, and Savings envelopes.
            </Text>

            {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => {
              const strat = STRATEGIES[id];
              const isSelected = id === strategyId;
              return (
                <Pressable
                  key={id}
                  onPress={() => setStrategyId(id)}
                  className={`p-4 rounded-2xl border ${
                    isSelected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-base font-bold text-neutral-900 dark:text-white">
                      {strat.name}
                    </Text>
                    {isSelected && (
                      <View className="bg-primary px-2 py-0.5 rounded-full">
                        <Text className="text-xs text-white font-bold">Active</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                    {strat.description}
                  </Text>
                  <View className="flex-row justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    <Text className="text-xs font-semibold text-blue-600">
                      Needs: {(strat.needsRatio * 100).toFixed(0)}%
                    </Text>
                    <Text className="text-xs font-semibold text-orange-600">
                      Wants: {(strat.wantsRatio * 100).toFixed(0)}%
                    </Text>
                    <Text className="text-xs font-semibold text-emerald-600">
                      Savings: {(strat.savingsRatio * 100).toFixed(0)}%
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {step === 5 && (
          <View className="space-y-6">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              Review your setup
            </Text>
            <Text className="text-neutral-500 dark:text-neutral-400 text-sm mb-4">
              Your plan is ready! Every dirham is conserved across your envelopes and places.
            </Text>

            <View className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 space-y-3">
              <View className="flex-row justify-between">
                <Text className="text-neutral-500 dark:text-neutral-400">Monthly Income:</Text>
                <Text className="font-bold text-neutral-900 dark:text-white">
                  {numericIncome} {currency}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-neutral-500 dark:text-neutral-400">Strategy:</Text>
                <Text className="font-bold text-neutral-900 dark:text-white">
                  {strategy.name}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-neutral-500 dark:text-neutral-400">Active Categories:</Text>
                <Text className="font-bold text-neutral-900 dark:text-white">
                  {selectedCategories.length} categories
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-neutral-500 dark:text-neutral-400">Recurring Bills:</Text>
                <Text className="font-bold text-neutral-900 dark:text-white">
                  {bills.length} bills
                </Text>
              </View>
            </View>

            <View className="bg-primary/10 p-4 rounded-2xl border border-primary/20 space-y-2">
              <Text className="text-sm font-bold text-primary mb-1">
                Envelope Allocations
              </Text>
              <View className="flex-row justify-between">
                <Text className="text-blue-600 font-medium">Needs Envelope:</Text>
                <Text className="text-blue-600 font-bold">{envelopeAmounts.needs} {currency}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-orange-600 font-medium">Wants Envelope:</Text>
                <Text className="text-orange-600 font-bold">{envelopeAmounts.wants} {currency}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-emerald-600 font-medium">Savings Envelope:</Text>
                <Text className="text-emerald-600 font-bold">{envelopeAmounts.savings} {currency}</Text>
              </View>
            </View>
          </View>
        )}

        <View className="flex-row justify-between mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Pressable
            onPress={() => (step > 1 ? setStep(step - 1) : router.replace('/login'))}
            className="px-6 py-3 rounded-xl bg-neutral-200 dark:bg-neutral-800 items-center justify-center"
          >
            <Text className="text-neutral-800 dark:text-neutral-200 font-semibold text-sm">
              Back
            </Text>
          </Pressable>

          {step < 5 ? (
            <Pressable
              onPress={() => setStep(step + 1)}
              className="px-8 py-3 rounded-xl bg-primary items-center justify-center"
            >
              <Text className="text-white font-semibold text-sm">Next</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleFinish}
              disabled={loading}
              className="px-8 py-3 rounded-xl bg-primary items-center justify-center"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-sm">Complete Setup</Text>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
