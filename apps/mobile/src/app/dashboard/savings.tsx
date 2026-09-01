import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { DashboardScrollView as ScrollView } from '../../components/DashboardScrollView';
import { PlusCircle, PiggyBank, MoreVertical, Plus, Minus } from 'lucide-react-native';
import {
  type SavingGoal,
  type MonthBudget,
  saveGoalWithBalance,
  calculateMonthlyDepositedSavings,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { SavingsGoalModal, SavingsActionModal } from '../../components/SavingsModal';
import { formatMoney } from '../../lib/format-money';
import { FONT } from '../../lib/fonts';

const TEAL = '#00685f';
const SECONDARY = '#00687b';

export default function SavingsScreen() {
  const { month, savingsGoals, updateMonth, updateSavingsGoals, currency, canEditArea, moneyPlaces } =
    useMobileStore();
  const canEdit = canEditArea('savings');

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingGoal | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingGoal | null>(null);

  const totalSaved = savingsGoals.reduce((acc, g) => acc + (g.current || 0), 0);
  const deposits = month?.savingsActivity || [];
  const monthlyNet = month ? calculateMonthlyDepositedSavings(month) : 0;
  const placeName = (id: string) => moneyPlaces.find((p) => p.id === id)?.name || id;

  const handleSaveGoal = async (goal: SavingGoal, deductFromPlace?: string | null) => {
    if (!month) {
      await updateSavingsGoals([...savingsGoals.filter((g) => g.id !== goal.id), goal]);
      return;
    }
    const res = saveGoalWithBalance(month, savingsGoals, goal, deductFromPlace ?? null);
    if (res.month !== month) await updateMonth(res.month);
    await updateSavingsGoals(res.goals);
  };

  return (
    <View className="flex-1 bg-[#F5FAF8]">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View className="mb-4 flex-row items-center justify-between rounded-3xl border border-neutral-200 bg-white p-4">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Total accumulated
            </Text>
            <View className="mt-0.5 flex-row items-baseline">
              <Text className="text-[24px] font-extrabold font-mono text-neutral-900" style={{ fontFamily: FONT.monoBold }}>
                {formatMoney(totalSaved)}
              </Text>
              <Text className="ml-1 text-xs font-semibold text-neutral-500">{currency}</Text>
            </View>
          </View>
          {canEdit ? (
            <Pressable
              onPress={() => {
                setEditingGoal(null);
                setCreateModalVisible(true);
              }}
              className="shrink-0 flex-row items-center rounded-xl px-4 py-3"
              style={{ backgroundColor: TEAL }}
            >
              <PlusCircle size={20} color="#fff" />
              <Text className="ml-1.5 text-xs font-bold text-white">New Goal</Text>
            </Pressable>
          ) : null}
        </View>

        {savingsGoals.length === 0 ? (
          <View className="mb-4 items-center rounded-2xl border border-dashed border-neutral-300 px-6 py-10">
            <PiggyBank size={44} color="#9CA3AF" />
            <Text className="mt-2 text-center text-sm text-neutral-500">No active saving goals.</Text>
          </View>
        ) : (
          savingsGoals.map((goal) => {
            const pct = goal.target > 0 ? Math.min(100, Math.round(((goal.current || 0) / goal.target) * 100)) : 0;
            return (
              <View key={goal.id} className="mb-3 rounded-3xl border border-neutral-200 bg-white p-4">
                <View className="mb-3 flex-row items-start justify-between">
                  <View className="flex-row items-center">
                    <View className="mr-2 h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(0,104,123,0.1)' }}>
                      <PiggyBank size={26} color={SECONDARY} />
                    </View>
                    <View>
                      <Text className="text-base font-extrabold text-neutral-900">{goal.name}</Text>
                      <Text className="text-[11px] capitalize text-neutral-500">
                        Source: {placeName(goal.source || 'bank')}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      setEditingGoal(goal);
                      setCreateModalVisible(true);
                    }}
                    hitSlop={8}
                    className="p-2"
                  >
                    <MoreVertical size={20} color="#6B7280" />
                  </Pressable>
                </View>

                <View className="mb-1 flex-row items-baseline justify-between">
                  <View className="flex-row items-baseline">
                    <Text className="text-xl font-extrabold font-mono text-neutral-900" style={{ fontFamily: FONT.monoBold }}>
                      {formatMoney(goal.current || 0)}
                    </Text>
                    <Text className="ml-1 text-xs font-semibold text-neutral-500">{currency}</Text>
                  </View>
                  <Text className="text-xs text-neutral-500">Target {formatMoney(goal.target)} {currency}</Text>
                </View>
                <View className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(0,104,95,0.2)' }}>
                  <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SECONDARY }} />
                </View>
                <Text className="mt-1 text-right text-[11px] font-bold" style={{ color: SECONDARY }}>
                  {pct}% reached
                </Text>

                {canEdit ? (
                  <View className="mt-3 flex-row gap-2">
                    <Pressable
                      onPress={() => {
                        setSelectedGoal(goal);
                        setActionModalVisible(true);
                      }}
                      className="flex-1 flex-row items-center justify-center rounded-xl py-2.5"
                      style={{ backgroundColor: 'rgba(0,104,95,0.1)' }}
                    >
                      <Plus size={18} color={TEAL} />
                      <Text className="ml-1 text-xs font-bold" style={{ color: TEAL }}>
                        Deposit
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setSelectedGoal(goal);
                        setActionModalVisible(true);
                      }}
                      className="flex-1 flex-row items-center justify-center rounded-xl bg-neutral-100 py-2.5"
                    >
                      <Minus size={18} color="#6B7280" />
                      <Text className="ml-1 text-xs font-bold text-neutral-500">Withdraw</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <View className="mt-2 rounded-3xl border border-neutral-200 bg-white p-4">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            This month&apos;s deposits
          </Text>
          <Text className="mb-3 text-[11px] text-neutral-500">
            {deposits.length} movement{deposits.length === 1 ? '' : 's'} logged
            {month ? ` · ${formatMoney(monthlyNet)} ${currency} saved` : ''}
          </Text>
          {deposits.length === 0 ? (
            <Text className="py-4 text-center text-sm text-neutral-400">No deposits logged this month.</Text>
          ) : (
            deposits.map((entry) => {
              const isDeposit = entry.type === 'deposit';
              return (
                <View key={entry.id} className="flex-row items-center border-t border-neutral-100 py-3">
                  <View
                    className="mr-3 h-10 w-10 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: isDeposit ? 'rgba(0,104,123,0.1)' : '#ECEEEF' }}
                  >
                    {isDeposit ? <Plus size={20} color={SECONDARY} /> : <Minus size={20} color="#6B7280" />}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-bold text-neutral-900" numberOfLines={1}>
                      {entry.goalName}
                    </Text>
                    <Text className="text-[11px] text-neutral-500" numberOfLines={1}>
                      {isDeposit ? 'Deposit' : 'Withdrawal'} · {String(entry.date).slice(0, 10)}
                      {entry.place ? ` · ${placeName(entry.place)}` : ''}
                    </Text>
                  </View>
                  <Text
                    className="font-mono text-sm font-bold"
                    style={{ fontFamily: FONT.monoBold, color: isDeposit ? SECONDARY : '#6B7280' }}
                  >
                    {isDeposit ? '+' : '-'}
                    {formatMoney(entry.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <SavingsGoalModal
        visible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingGoal(null);
        }}
        currency={currency}
        goalToEdit={editingGoal}
        onSave={handleSaveGoal}
      />

      {month ? (
        <SavingsActionModal
          visible={actionModalVisible}
          onClose={() => setActionModalVisible(false)}
          goal={selectedGoal}
          month={month}
          goals={savingsGoals}
          currency={currency}
          onUpdateStore={async (newMonth: MonthBudget, newGoals: SavingGoal[]) => {
            await updateMonth(newMonth);
            await updateSavingsGoals(newGoals);
          }}
        />
      ) : null}
    </View>
  );
}
