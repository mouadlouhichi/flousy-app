import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { DashboardScrollView as ScrollView } from '../../components/DashboardScrollView';
import { PlusCircle } from 'lucide-react-native';
import {
  type DebtItem,
  addDebt,
  editDebt,
  deleteDebt,
  toggleDebtStatus,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { DebtModal } from '../../components/DebtModal';
import { formatMoney } from '../../lib/format-money';
import { FONT } from '../../lib/fonts';

const TEAL = '#00685f';

export default function DebtsScreen() {
  const { month, updateMonth, currency, canEditArea } = useMobileStore();
  const canEdit = canEditArea('debts');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);
  const [tab, setTab] = useState<'debt' | 'credit'>('debt');

  const debts = month?.debts || [];
  const filtered = debts.filter((d) => d.type === tab);
  const openCount = filtered.filter((d) => d.status === 'open').length;
  const settledCount = filtered.filter((d) => d.status === 'settled').length;
  const totalAmount = useMemo(
    () => filtered.reduce((acc, d) => acc + d.amount, 0),
    [filtered],
  );

  return (
    <View className="flex-1 bg-[#F5FAF8]">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View className="mb-4 flex-row rounded-2xl bg-neutral-200/60 p-1">
          {(['debt', 'credit'] as const).map((key) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                className="flex-1 items-center rounded-xl py-2.5"
                style={{ backgroundColor: active ? TEAL : 'transparent' }}
              >
                <Text className={`text-sm font-bold ${active ? 'text-white' : 'text-neutral-500'}`}>
                  {key === 'debt' ? 'Debts I Owe' : 'Credits Owed to Me'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mb-4 rounded-3xl border border-neutral-200 bg-white p-5">
          <Text className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
            {tab === 'debt' ? 'Total you owe' : 'Total owed to you'}
          </Text>
          <View className="mt-1 flex-row items-baseline">
            <Text className="text-[36px] font-extrabold font-mono text-neutral-900" style={{ fontFamily: FONT.monoBold }}>
              {formatMoney(totalAmount)}
            </Text>
            <Text className="ml-1.5 text-lg font-extrabold text-neutral-400">{currency}</Text>
          </View>
          <Text className="mt-1.5 text-[13px] text-neutral-500">
            {openCount} open · {settledCount} settled
          </Text>
          {canEdit ? (
            <Pressable
              onPress={() => {
                setEditingDebt(null);
                setModalVisible(true);
              }}
              className="mt-4 flex-row items-center self-start rounded-xl px-4 py-3"
              style={{ backgroundColor: TEAL }}
            >
              <PlusCircle size={18} color="#fff" />
              <Text className="ml-1.5 text-xs font-bold text-white">Add Record</Text>
            </Pressable>
          ) : null}
        </View>

        {filtered.length === 0 ? (
          <View className="items-center rounded-2xl border border-dashed border-neutral-300 px-6 py-10">
            <Text className="text-center text-sm font-semibold text-neutral-500">
              {tab === 'debt' ? 'No debts recorded.' : 'No credits recorded.'}
            </Text>
          </View>
        ) : (
          filtered.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                if (!canEdit) return;
                setEditingDebt(item);
                setModalVisible(true);
              }}
              className="mb-3 rounded-2xl border border-neutral-200 bg-white p-4"
            >
              <View className="flex-row items-start justify-between">
                <View className="min-w-0 flex-1 pr-3">
                  <Text className="text-base font-bold text-neutral-900">{item.name}</Text>
                  <Text className="mt-0.5 text-[11px] text-neutral-500">
                    {item.date}
                    {item.note ? ` · ${item.note}` : ''}
                  </Text>
                </View>
                <View className="items-end">
                  <View className="flex-row items-baseline">
                    <Text className="text-base font-extrabold font-mono text-neutral-900" style={{ fontFamily: FONT.monoBold }}>
                      {formatMoney(item.amount)}
                    </Text>
                    <Text className="ml-0.5 text-[10px] font-semibold text-neutral-500">{currency}</Text>
                  </View>
                  <Pressable
                    onPress={() => month && updateMonth(toggleDebtStatus(month, item.id))}
                    className="mt-1 rounded-full px-2.5 py-0.5"
                    style={{ backgroundColor: item.status === 'open' ? '#FEF3C7' : '#DBEAFE' }}
                  >
                    <Text className="text-[10px] font-semibold text-neutral-700">
                      {item.status === 'open' ? 'Open' : 'Settled'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <DebtModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        currency={currency}
        debtToEdit={editingDebt}
        onSave={async (debt) => {
          if (!month) return;
          if (editingDebt) await updateMonth(editDebt(month, editingDebt.id, debt));
          else await updateMonth(addDebt(month, debt));
        }}
        onDelete={async (debtId) => {
          if (!month) return;
          await updateMonth(deleteDebt(month, debtId));
        }}
      />
    </View>
  );
}
