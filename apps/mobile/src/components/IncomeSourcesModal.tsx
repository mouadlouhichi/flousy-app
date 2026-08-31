import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Sheet } from './Sheet';
import { type IncomeSource, type MonthBudget } from '@flousy/core';

interface IncomeSourcesModalProps {
  visible: boolean;
  onClose: () => void;
  month: MonthBudget;
  currency: string;
  onUpdateMonth: (nextMonth: MonthBudget) => Promise<void>;
}

export function IncomeSourcesModal({
  visible,
  onClose,
  month,
  currency,
  onUpdateMonth,
}: IncomeSourcesModalProps) {
  const [sourceName, setSourceName] = useState('');
  const [sourceAmount, setSourceAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const sources = month.incomeSources || [
    {
      id: 'main-income',
      name: 'Main Income',
      amount: month.totalBudget,
    },
  ];

  const handleAddSource = async () => {
    const amt = parseFloat(sourceAmount);
    if (!sourceName.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Entry', 'Please enter a valid income source name and amount.');
      return;
    }

    setLoading(true);
    try {
      const newSource: IncomeSource = {
        id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: sourceName.trim(),
        amount: amt,
      };

      const updatedSources = [...sources, newSource];
      const newTotal = updatedSources.reduce((acc, s) => acc + s.amount, 0);

      const nextMonth: MonthBudget = {
        ...month,
        incomeSources: updatedSources,
        totalBudget: newTotal,
      };

      await onUpdateMonth(nextMonth);
      setSourceName('');
      setSourceAmount('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add income source.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSource = async (id: string) => {
    if (sources.length <= 1) {
      Alert.alert(
        'Cannot Remove',
        'You must have at least one income source. Adjust the amount instead.'
      );
      return;
    }

    setLoading(true);
    try {
      const updatedSources = sources.filter((s) => s.id !== id);
      const newTotal = updatedSources.reduce((acc, s) => acc + s.amount, 0);

      const nextMonth: MonthBudget = {
        ...month,
        incomeSources: updatedSources,
        totalBudget: newTotal,
      };

      await onUpdateMonth(nextMonth);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to remove income source.');
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = sources.reduce((acc, s) => acc + s.amount, 0);

  return (
    <Sheet visible={visible} onClose={onClose}>
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6 max-h-[85%]">
          <View className="flex-row justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-4">
            <View>
              <Text className="text-xl font-bold text-neutral-900 dark:text-white">
                Income Sources
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                Total Income: {totalIncome} {currency}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold text-base">Close</Text>
            </Pressable>
          </View>

          <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            Track multiple income streams (salary, freelance, dividends). The sum is your month's
            total budget.
          </Text>

          <View className="flex-row space-x-2 mb-4">
            <TextInput
              className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm"
              placeholder="Source name (e.g. Freelance)"
              placeholderTextColor="#9ca3af"
              value={sourceName}
              onChangeText={setSourceName}
            />
            <TextInput
              className="w-28 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 font-bold text-sm text-center"
              placeholder="Amount"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={sourceAmount}
              onChangeText={setSourceAmount}
            />
          </View>

          <Pressable
            onPress={handleAddSource}
            disabled={loading}
            className="w-full bg-neutral-800 dark:bg-neutral-700 py-3 rounded-xl items-center mb-4"
          >
            <Text className="text-white font-semibold text-sm">+ Add Income Stream</Text>
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} className="space-y-2">
            {sources.map((s) => (
              <View
                key={s.id}
                className="bg-neutral-50 dark:bg-neutral-800 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 flex-row justify-between items-center"
              >
                <View>
                  <Text className="font-bold text-neutral-900 dark:text-white">{s.name}</Text>
                </View>
                <View className="flex-row items-center space-x-4">
                  <Text className="font-extrabold text-primary">
                    {s.amount} {currency}
                  </Text>
                  {sources.length > 1 && (
                    <Pressable onPress={() => handleRemoveSource(s.id)}>
                      <Text className="text-red-500 font-bold text-sm">Remove</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
    </Sheet>
  );
}
