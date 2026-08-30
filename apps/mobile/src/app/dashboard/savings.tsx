import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { type SavingGoal, type MonthBudget, saveGoalWithBalance } from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { SavingsGoalModal, SavingsActionModal } from '../../components/SavingsModal';

export default function SavingsScreen() {
  const { month, savingsGoals, updateMonth, updateSavingsGoals, currency, canEditArea } =
    useMobileStore();
  const canEdit = canEditArea('savings');

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingGoal | null>(null);

  const handleSaveGoal = async (goal: SavingGoal, deductFromPlace?: string | null) => {
    if (!month) {
      await updateSavingsGoals([...savingsGoals.filter((g) => g.id !== goal.id), goal]);
      return;
    }
    const res = saveGoalWithBalance(month, savingsGoals, goal, deductFromPlace ?? null);
    if (res.month !== month) await updateMonth(res.month);
    await updateSavingsGoals(res.goals);
  };

  const handleOpenAction = (goal: SavingGoal) => {
    if (!canEdit) return;
    setSelectedGoal(goal);
    setActionModalVisible(true);
  };

  const handleUpdateStore = async (newMonth: MonthBudget, newGoals: SavingGoal[]) => {
    await updateMonth(newMonth);
    await updateSavingsGoals(newGoals);
  };

  const totalSaved = savingsGoals.reduce((acc, g) => acc + (g.current || 0), 0);
  const totalTarget = savingsGoals.reduce((acc, g) => acc + (g.target || 0), 0);

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <View className="p-4 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <View className="flex-row justify-between items-center mb-1">
          <View>
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              Global Saving Goals
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              Total Saved: {totalSaved} / {totalTarget} {currency}
            </Text>
          </View>
          {canEdit ? (
            <Pressable
              onPress={() => setCreateModalVisible(true)}
              className="bg-primary px-4 py-2.5 rounded-xl shadow-sm"
            >
              <Text className="text-white font-bold text-sm">+ Goal</Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          Goals survive month rollovers. Deleting a funded goal returns cash to its source place.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {savingsGoals.length === 0 ? (
          <View className="bg-white dark:bg-neutral-800 p-8 rounded-2xl items-center justify-center border border-neutral-200 dark:border-neutral-700">
            <Text className="text-neutral-500 dark:text-neutral-400 font-semibold mb-1">
              No saving goals yet
            </Text>
            <Text className="text-xs text-neutral-400 text-center">
              Tap "+ Goal" to create your emergency fund, vacation target, or investment reserve.
            </Text>
          </View>
        ) : (
          savingsGoals.map((goal) => {
            const pct =
              goal.target > 0
                ? Math.min(100, Math.round(((goal.current || 0) / goal.target) * 100))
                : 0;
            return (
              <Pressable
                key={goal.id}
                onPress={() => handleOpenAction(goal)}
                className="bg-white dark:bg-neutral-800 p-4 rounded-2xl mb-3 border border-neutral-200 dark:border-neutral-700 shadow-xs"
              >
                <View className="flex-row justify-between items-center mb-2">
                  <View>
                    <Text className="font-bold text-base text-neutral-900 dark:text-white">
                      {goal.name}
                    </Text>
                    <Text className="text-xs text-neutral-400">
                      Source account: <Text className="capitalize font-semibold">{goal.source || 'bank'}</Text>
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-bold text-base text-primary">
                      {goal.current || 0} / {goal.target} {currency}
                    </Text>
                    <Text className="text-xs text-neutral-400 font-medium">
                      {pct}% reached
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden mt-1">
                  <View
                    style={{ width: `${pct}%` }}
                    className="h-full rounded-full bg-primary"
                  />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <SavingsGoalModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        currency={currency}
        onSave={handleSaveGoal}
      />

      {month && (
        <SavingsActionModal
          visible={actionModalVisible}
          onClose={() => setActionModalVisible(false)}
          goal={selectedGoal}
          month={month}
          goals={savingsGoals}
          currency={currency}
          onUpdateStore={handleUpdateStore}
        />
      )}
    </View>
  );
}
