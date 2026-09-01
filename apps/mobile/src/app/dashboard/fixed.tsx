import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { DashboardScrollView as ScrollView } from '../../components/DashboardScrollView';
import { PlusCircle, Receipt, Repeat } from 'lucide-react-native';
import {
  type FixedExpense,
  addFixedExpense,
  editFixedExpense,
  deleteFixedExpense,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { FixedModal } from '../../components/FixedModal';
import { formatMoney } from '../../lib/format-money';
import { FONT } from '../../lib/fonts';

const TEAL = '#00685f';

export default function FixedBillsScreen() {
  const { month, updateMonth, currency, canEditArea, moneyPlaces } = useMobileStore();
  const canEdit = canEditArea('fixedBills');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBill, setEditingBill] = useState<FixedExpense | null>(null);

  const bills = month?.fixedExpenses || [];
  const totalBills = bills.reduce((acc, b) => acc + b.amount, 0);
  const placeName = (id: string) => moneyPlaces.find((p) => p.id === id)?.name || id;

  return (
    <View className="flex-1 bg-[#F5FAF8]">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View className="mb-4 flex-row items-center justify-between rounded-3xl border border-neutral-200 bg-white p-4">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Total monthly commitments
            </Text>
            <View className="mt-0.5 flex-row items-baseline">
              <Text className="text-[24px] font-extrabold font-mono text-neutral-900" style={{ fontFamily: FONT.monoBold }}>
                {formatMoney(totalBills)}
              </Text>
              <Text className="ml-1 text-xs font-semibold text-neutral-500">{currency}</Text>
            </View>
          </View>
          {canEdit ? (
            <Pressable
              onPress={() => {
                setEditingBill(null);
                setModalVisible(true);
              }}
              className="shrink-0 flex-row items-center rounded-xl px-4 py-3"
              style={{ backgroundColor: TEAL }}
            >
              <PlusCircle size={20} color="#fff" />
              <Text className="ml-1.5 text-xs font-bold text-white">Add Charge</Text>
            </Pressable>
          ) : null}
        </View>

        {bills.length === 0 ? (
          <View className="items-center rounded-2xl border border-dashed border-neutral-300 px-6 py-10">
            <Receipt size={44} color="#9CA3AF" />
            <Text className="mt-2 text-center text-sm text-neutral-500">No fixed charges recorded.</Text>
            {canEdit ? (
              <Pressable
                onPress={() => setModalVisible(true)}
                className="mt-3 rounded-xl px-4 py-2"
                style={{ backgroundColor: TEAL }}
              >
                <Text className="text-xs font-bold text-white">Add Rent & Bills</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          bills.map((bill) => (
            <Pressable
              key={bill.id}
              onPress={() => {
                if (!canEdit) return;
                setEditingBill(bill);
                setModalVisible(true);
              }}
              className="mb-3 flex-row items-center rounded-2xl border border-neutral-200 bg-white p-3"
            >
              <View className="mr-3 h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(0,104,95,0.1)' }}>
                <Receipt size={24} color={TEAL} />
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center">
                  <Text className="min-w-0 flex-1 text-base font-bold text-neutral-900" numberOfLines={1}>
                    {bill.name}
                  </Text>
                  {bill.person && bill.person !== 'Self' ? (
                    <View className="ml-1.5 rounded-full bg-[#d9dff5] px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-[#404758]">{bill.person}</Text>
                    </View>
                  ) : null}
                  {bill.recurring ? <Repeat size={16} color={TEAL} style={{ marginLeft: 4 }} /> : null}
                </View>
                <Text className="mt-0.5 text-[11px] text-neutral-500" numberOfLines={1}>
                  {bill.type} • {placeName(bill.place)} • Due {bill.date || 'monthly'}
                </Text>
              </View>
              <View className="ml-2 shrink-0 flex-row items-baseline">
                <Text className="text-base font-extrabold font-mono text-neutral-900" style={{ fontFamily: FONT.monoBold }}>
                  {formatMoney(bill.amount)}
                </Text>
                <Text className="ml-0.5 font-semibold text-neutral-500" style={{ fontSize: 10 }}>
                  {currency}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {month ? (
        <FixedModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          month={month}
          currency={currency}
          billToEdit={editingBill}
          onSave={async (bill) => {
            if (editingBill) await updateMonth(editFixedExpense(month, editingBill, bill));
            else await updateMonth(addFixedExpense(month, bill));
          }}
          onDelete={async (bill) => {
            await updateMonth(deleteFixedExpense(month, bill));
          }}
        />
      ) : null}
    </View>
  );
}
