import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
} from 'react-native';
import { DashboardScrollView as ScrollView } from '../../components/DashboardScrollView';
import { useTranslation } from 'react-i18next';
import {
  type FixedExpense,
  addFixedExpense,
  editFixedExpense,
  deleteFixedExpense,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { FixedModal } from '../../components/FixedModal';

export default function FixedBillsScreen() {
  const { t } = useTranslation();
  const { month, updateMonth, currency, canEditArea } = useMobileStore();
  const canEdit = canEditArea('fixedBills');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingBill, setEditingBill] = useState<FixedExpense | null>(null);

  const bills = month?.fixedExpenses || [];

  const handleOpenAdd = () => {
    setEditingBill(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (bill: FixedExpense) => {
    if (!canEdit) return;
    setEditingBill(bill);
    setModalVisible(true);
  };

  const handleSaveBill = async (bill: FixedExpense) => {
    if (!month) return;
    if (editingBill) {
      const nextMonth = editFixedExpense(month, editingBill, bill);
      await updateMonth(nextMonth);
    } else {
      const nextMonth = addFixedExpense(month, bill);
      await updateMonth(nextMonth);
    }
  };

  const handleDeleteBill = async (bill: FixedExpense) => {
    if (!month) return;
    const nextMonth = deleteFixedExpense(month, bill);
    await updateMonth(nextMonth);
  };

  const totalBills = bills.reduce((acc, b) => acc + b.amount, 0);

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <View className="p-4 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <View className="flex-row justify-between items-center mb-1">
          <View>
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              Recurring Fixed Bills
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              Total Fixed: {totalBills} {currency} ({bills.length} bills)
            </Text>
          </View>
          {canEdit ? (
            <Pressable
              onPress={handleOpenAdd}
              className="bg-primary px-4 py-2.5 rounded-xl shadow-sm"
            >
              <Text className="text-white font-bold text-sm">+ Bill</Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          Recurring bills carry over automatically when you navigate to a new month.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {bills.length === 0 ? (
          <View className="bg-white dark:bg-neutral-800 p-8 rounded-2xl items-center justify-center border border-neutral-200 dark:border-neutral-700">
            <Text className="text-neutral-500 dark:text-neutral-400 font-semibold mb-1">
              No recurring fixed bills
            </Text>
            <Text className="text-xs text-neutral-400 text-center">
              Tap "+ Bill" to add monthly charges like rent, subscriptions, or insurance.
            </Text>
          </View>
        ) : (
          bills.map((bill) => (
            <Pressable
              key={bill.id}
              onPress={() => handleOpenEdit(bill)}
              className="bg-white dark:bg-neutral-800 p-4 rounded-2xl mb-2.5 border border-neutral-200 dark:border-neutral-700 flex-row justify-between items-center shadow-xs"
            >
              <View className="flex-1 mr-3">
                <View className="flex-row items-center space-x-2 mb-0.5">
                  <Text className="font-bold text-base text-neutral-900 dark:text-white">
                    {bill.name}
                  </Text>
                  {bill.recurring ? (
                    <View className="bg-blue-500/10 px-2 py-0.5 rounded-md">
                      <Text className="text-xs font-bold text-blue-600">
                        Recurring
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-xs text-neutral-400">
                  Paid from: <Text className="font-semibold capitalize">{bill.place}</Text> • {bill.date}
                  {bill.person ? ` • ${bill.person}` : ''}
                </Text>
              </View>

              <View className="items-end">
                <Text className="font-extrabold text-lg text-neutral-900 dark:text-white">
                  -{bill.amount} {currency}
                </Text>
                <Text className="text-xs text-primary font-semibold">Tap to edit</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {month && (
        <FixedModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          month={month}
          currency={currency}
          billToEdit={editingBill}
          onSave={handleSaveBill}
          onDelete={handleDeleteBill}
        />
      )}
    </View>
  );
}
