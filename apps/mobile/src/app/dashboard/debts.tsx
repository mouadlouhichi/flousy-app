import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import {
  type DebtItem,
  addDebt,
  editDebt,
  deleteDebt,
  toggleDebtStatus,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { DebtModal } from '../../components/DebtModal';

const DEFAULT_CURRENCY = 'MAD';

export default function DebtsScreen() {
  const { month, updateMonth } = useMobileStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'settled'>('all');

  const currency = DEFAULT_CURRENCY;
  const debts = month?.debts || [];

  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      if (filter === 'open') return d.status === 'open';
      if (filter === 'settled') return d.status === 'settled';
      return true;
    });
  }, [debts, filter]);

  const totalIOwe = useMemo(() => {
    return debts
      .filter((d) => d.type === 'debt' && d.status === 'open')
      .reduce((acc, d) => acc + d.amount, 0);
  }, [debts]);

  const totalOwedToMe = useMemo(() => {
    return debts
      .filter((d) => d.type === 'credit' && d.status === 'open')
      .reduce((acc, d) => acc + d.amount, 0);
  }, [debts]);

  const handleOpenAdd = () => {
    setEditingDebt(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (debt: DebtItem) => {
    setEditingDebt(debt);
    setModalVisible(true);
  };

  const handleSaveDebt = async (debt: DebtItem) => {
    if (!month) return;
    if (editingDebt) {
      const nextMonth = editDebt(month, editingDebt.id, debt);
      await updateMonth(nextMonth);
    } else {
      const nextMonth = addDebt(month, debt);
      await updateMonth(nextMonth);
    }
  };

  const handleDeleteDebt = async (debtId: string) => {
    if (!month) return;
    const nextMonth = deleteDebt(month, debtId);
    await updateMonth(nextMonth);
  };

  const handleToggleStatus = async (debtId: string) => {
    if (!month) return;
    const nextMonth = toggleDebtStatus(month, debtId);
    await updateMonth(nextMonth);
  };

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <View className="p-4 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-xl font-bold text-neutral-900 dark:text-white">
            Debts & Credits Ledger
          </Text>
          <Pressable
            onPress={handleOpenAdd}
            className="bg-primary px-4 py-2.5 rounded-xl shadow-sm"
          >
            <Text className="text-white font-bold text-sm">+ Record</Text>
          </Pressable>
        </View>

        {/* Summary Cards */}
        <View className="flex-row space-x-2 mb-3">
          <View className="flex-1 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-900">
            <Text className="text-xs text-red-600 font-semibold mb-0.5">
              Total I Owe (Open)
            </Text>
            <Text className="text-base font-bold text-red-700 dark:text-red-300">
              {totalIOwe} {currency}
            </Text>
          </View>
          <View className="flex-1 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900">
            <Text className="text-xs text-emerald-600 font-semibold mb-0.5">
              Owed to Me (Open)
            </Text>
            <Text className="text-base font-bold text-emerald-700 dark:text-emerald-300">
              {totalOwedToMe} {currency}
            </Text>
          </View>
        </View>

        {/* Filters */}
        <View className="flex-row space-x-2">
          {(['all', 'open', 'settled'] as const).map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                className={`flex-1 py-1.5 rounded-xl border items-center ${
                  active
                    ? 'bg-primary border-primary'
                    : 'bg-neutral-100 dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600'
                }`}
              >
                <Text
                  className={`text-xs font-semibold capitalize ${
                    active ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {filteredDebts.length === 0 ? (
          <View className="bg-white dark:bg-neutral-800 p-8 rounded-2xl items-center justify-center border border-neutral-200 dark:border-neutral-700">
            <Text className="text-neutral-500 dark:text-neutral-400 font-semibold mb-1">
              No debt/credit records found
            </Text>
            <Text className="text-xs text-neutral-400 text-center">
              Tap "+ Record" to track money borrowed or lent.
            </Text>
          </View>
        ) : (
          filteredDebts.map((item) => (
            <View
              key={item.id}
              className="bg-white dark:bg-neutral-800 p-4 rounded-2xl mb-3 border border-neutral-200 dark:border-neutral-700 shadow-xs"
            >
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 mr-2">
                  <View className="flex-row items-center space-x-2 mb-1">
                    <Text className="font-bold text-base text-neutral-900 dark:text-white">
                      {item.name}
                    </Text>
                    <View
                      className={`px-2 py-0.5 rounded-md ${
                        item.type === 'debt' ? 'bg-red-500/10' : 'bg-emerald-500/10'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          item.type === 'debt' ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {item.type === 'debt' ? 'I Owe' : 'Owed to me'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-xs text-neutral-400">
                    Date: {item.date}
                    {item.note ? ` • "${item.note}"` : ''}
                  </Text>
                </View>

                <View className="items-end">
                  <Text className="font-extrabold text-lg text-neutral-900 dark:text-white">
                    {item.amount} {currency}
                  </Text>
                  <Pressable
                    onPress={() => handleToggleStatus(item.id)}
                    className={`mt-1 px-2.5 py-0.5 rounded-full border ${
                      item.status === 'open'
                        ? 'bg-amber-100 dark:bg-amber-900/50 border-amber-300'
                        : 'bg-blue-100 dark:bg-blue-900/50 border-blue-300'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        item.status === 'open'
                          ? 'text-amber-800 dark:text-amber-200'
                          : 'text-blue-800 dark:text-blue-200'
                      }`}
                    >
                      {item.status === 'open' ? 'Open (Tap to settle)' : 'Settled (Tap to open)'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View className="flex-row justify-end pt-2 border-t border-neutral-100 dark:border-neutral-700/50 mt-1">
                <Pressable onPress={() => handleOpenEdit(item)}>
                  <Text className="text-xs font-semibold text-primary">Edit Record</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <DebtModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        currency={currency}
        debtToEdit={editingDebt}
        onSave={handleSaveDebt}
        onDelete={handleDeleteDebt}
      />
    </View>
  );
}
