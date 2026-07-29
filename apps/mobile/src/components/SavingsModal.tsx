import React, { useState, useEffect } from 'react';
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
import { useTranslation } from 'react-i18next';
import {
  type SavingGoal,
  type MoneyPlace,
  type MonthBudget,
  fundGoal,
  withdrawGoal,
  deleteFundedGoal,
} from '@flousy/core';

interface SavingsGoalModalProps {
  visible: boolean;
  onClose: () => void;
  currency: string;
  goalToEdit?: SavingGoal | null;
  onSave: (goal: SavingGoal) => Promise<void>;
}

export function SavingsGoalModal({
  visible,
  onClose,
  currency,
  goalToEdit,
  onSave,
}: SavingsGoalModalProps) {
  const [name, setName] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [source, setSource] = useState<MoneyPlace>('bank');
  const [loading, setLoading] = useState(false);

  const places: { id: MoneyPlace; label: string }[] = [
    { id: 'bank', label: 'Bank Account' },
    { id: 'home', label: 'Home Cash' },
    { id: 'wallet', label: 'Wallet' },
  ];

  useEffect(() => {
    if (goalToEdit) {
      setName(goalToEdit.name);
      setTargetStr(String(goalToEdit.target));
      setSource(goalToEdit.source || 'bank');
    } else {
      setName('');
      setTargetStr('');
      setSource('bank');
    }
  }, [goalToEdit, visible]);

  const handleSave = async () => {
    const target = parseFloat(targetStr);
    if (!name.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Invalid Goal', 'Please enter a valid goal name and target amount.');
      return;
    }

    setLoading(true);
    try {
      const goal: SavingGoal = {
        id: goalToEdit ? goalToEdit.id : `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        target,
        current: goalToEdit ? goalToEdit.current : 0,
        source,
        active: true,
      };

      await onSave(goal);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save saving goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6">
          <View className="flex-row justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              {goalToEdit ? 'Edit Saving Goal' : 'Create Saving Goal'}
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold text-base">Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Goal Name
              </Text>
              <TextInput
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
                placeholder="e.g. Emergency Fund"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Target Amount ({currency})
              </Text>
              <TextInput
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 font-bold"
                placeholder="10000"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={targetStr}
                onChangeText={setTargetStr}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Default Source Account
              </Text>
              <View className="flex-row space-x-2">
                {places.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setSource(p.id)}
                    className={`flex-1 p-3 rounded-xl border items-center ${
                      source === p.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <Text
                      className={`font-semibold text-xs ${
                        source === p.id
                          ? 'text-primary'
                          : 'text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          <View className="pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-800">
            <Pressable
              onPress={handleSave}
              disabled={loading}
              className="w-full bg-primary py-3.5 rounded-xl items-center justify-center shadow-sm"
            >
              <Text className="text-white font-bold text-base">
                {loading ? 'Saving...' : goalToEdit ? 'Save Goal' : 'Create Goal'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface SavingsActionModalProps {
  visible: boolean;
  onClose: () => void;
  goal: SavingGoal | null;
  month: MonthBudget;
  goals: SavingGoal[];
  currency: string;
  onUpdateStore: (newMonth: MonthBudget, newGoals: SavingGoal[]) => Promise<void>;
}

export function SavingsActionModal({
  visible,
  onClose,
  goal,
  month,
  goals,
  currency,
  onUpdateStore,
}: SavingsActionModalProps) {
  const [amountStr, setAmountStr] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAmountStr('');
    setMode('deposit');
  }, [goal, visible]);

  if (!goal) return null;

  const handleAction = async () => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'deposit') {
        const { month: updatedMonth, goals: updatedGoals } = fundGoal(
          month,
          goals,
          goal.id,
          amount,
          goal.source || 'bank'
        );
        await onUpdateStore(updatedMonth, updatedGoals);
      } else {
        const { month: updatedMonth, goals: updatedGoals } = withdrawGoal(
          month,
          goals,
          goal.id,
          amount,
          goal.source || 'bank'
        );
        await onUpdateStore(updatedMonth, updatedGoals);
      }
      onClose();
    } catch (err: any) {
      Alert.alert('Transaction Error', err?.message || 'Failed to process transaction.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGoal = () => {
    Alert.alert(
      'Delete Saving Goal',
      goal.current > 0
        ? `Delete "${goal.name}"? The saved balance (${goal.current} ${currency}) will be returned to your ${goal.source || 'bank'}.`
        : `Delete "${goal.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & Refund',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { month: updatedMonth, goals: updatedGoals } = deleteFundedGoal(
                month,
                goals,
                goal.id
              );
              await onUpdateStore(updatedMonth, updatedGoals);
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete goal');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6">
          <View className="flex-row justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              {goal.name}
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold text-base">Close</Text>
            </Pressable>
          </View>

          <View className="flex-row space-x-2 mb-4">
            <Pressable
              onPress={() => setMode('deposit')}
              className={`flex-1 py-2.5 rounded-xl items-center border ${
                mode === 'deposit'
                  ? 'bg-primary border-primary'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              <Text
                className={`font-semibold text-xs ${
                  mode === 'deposit' ? 'text-white' : 'text-neutral-800 dark:text-neutral-200'
                }`}
              >
                + Deposit (Fund)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('withdraw')}
              className={`flex-1 py-2.5 rounded-xl items-center border ${
                mode === 'withdraw'
                  ? 'bg-amber-600 border-amber-600'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              <Text
                className={`font-semibold text-xs ${
                  mode === 'withdraw' ? 'text-white' : 'text-neutral-800 dark:text-neutral-200'
                }`}
              >
                - Withdraw (Return)
              </Text>
            </Pressable>
          </View>

          <View className="space-y-3 mb-4">
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {mode === 'deposit'
                ? `Debits cash from ${goal.source || 'bank'} and adds to goal balance.`
                : `Withdraws cash from goal balance and returns to ${goal.source || 'bank'}.`}
            </Text>
            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Amount ({currency})
              </Text>
              <TextInput
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 font-bold text-lg"
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={amountStr}
                onChangeText={setAmountStr}
              />
            </View>
          </View>

          <View className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex-row space-x-3">
            <Pressable
              onPress={handleDeleteGoal}
              disabled={loading}
              className="flex-1 bg-red-500/10 border border-red-500/30 py-3.5 rounded-xl items-center justify-center"
            >
              <Text className="text-red-500 font-bold text-sm">Delete & Refund</Text>
            </Pressable>
            <Pressable
              onPress={handleAction}
              disabled={loading}
              className="flex-2 bg-primary py-3.5 rounded-xl items-center justify-center shadow-sm flex-1"
            >
              <Text className="text-white font-bold text-sm">
                {loading ? 'Processing...' : mode === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdraw'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
