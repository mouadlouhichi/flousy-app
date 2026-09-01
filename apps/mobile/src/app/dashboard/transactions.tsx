import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView as HScroll } from 'react-native';
import { DashboardScrollView as ScrollView } from '../../components/DashboardScrollView';
import { useRouter } from 'expo-router';
import { PlusCircle, ScanLine, Search, ChevronDown, ChevronRight } from 'lucide-react-native';
import {
  type VariableExpense,
  addVariableExpense,
  editVariableExpense,
  deleteVariableExpense,
  calculateCategorySpent,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { ExpenseModal } from '../../components/ExpenseModal';
import { CategoryIcon } from '../../components/CategoryIcon';
import { formatMoney } from '../../lib/format-money';
import { FONT } from '../../lib/fonts';

function formatShortDate(iso: string): string {
  const day = (iso || '').slice(0, 10);
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const TEAL = '#00685f';

export default function TransactionsScreen() {
  const router = useRouter();
  const { month, updateMonth, currency, canEditArea, moneyPlaces } = useMobileStore();
  const canEdit = canEditArea('expenses');

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<VariableExpense | null>(null);
  const [budgetsOpen, setBudgetsOpen] = useState(false);

  const expenses = month?.variableExpenses || [];
  const categories = ['All', ...(month?.activeCategories || [])];
  const totalSpent = expenses.reduce((acc, e) => acc + e.amount, 0);

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((exp) => {
        if (selectedCategory !== 'All' && exp.type !== selectedCategory) return false;
        if (!q) return true;
        return (
          exp.name.toLowerCase().includes(q) ||
          exp.type.toLowerCase().includes(q) ||
          (exp.note && exp.note.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [expenses, search, selectedCategory]);

  const placeName = (id: string) => moneyPlaces.find((p) => p.id === id)?.name || id;

  const handleSaveExpense = async (expense: VariableExpense) => {
    if (!month) return;
    if (editingExpense) await updateMonth(editVariableExpense(month, editingExpense, expense));
    else await updateMonth(addVariableExpense(month, expense));
  };

  return (
    <View className="flex-1 bg-[#F5FAF8]">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} className="gap-4">
        <View className="mb-4 flex-row items-center justify-between rounded-3xl border border-neutral-200 bg-white p-4">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Total variable spent
            </Text>
            <View className="mt-0.5 flex-row items-baseline">
              <Text className="text-[24px] font-extrabold font-mono text-neutral-900" style={{ fontFamily: FONT.monoBold }}>
                {formatMoney(totalSpent)}
              </Text>
              <Text className="ml-1 text-xs font-semibold text-neutral-500">{currency}</Text>
            </View>
          </View>
          {canEdit ? (
            <Pressable
              onPress={() => {
                setEditingExpense(null);
                setModalVisible(true);
              }}
              className="shrink-0 flex-row items-center rounded-xl px-4 py-3"
              style={{ backgroundColor: TEAL }}
            >
              <PlusCircle size={20} color="#fff" />
              <Text className="ml-1.5 text-xs font-bold text-white">Add Expense</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => router.push('/dashboard/courses')}
          className="mb-4 flex-row items-center rounded-3xl border border-neutral-200 bg-white px-4 py-3.5"
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(0,104,95,0.1)' }}>
            <ScanLine size={22} color={TEAL} />
          </View>
          <View className="mx-3 min-w-0 flex-1">
            <Text className="text-base font-bold text-neutral-900">New course</Text>
            <Text className="text-[11px] text-neutral-500" numberOfLines={1}>
              Start a session, scan each product&apos;s barcode and add the …
            </Text>
          </View>
          <ChevronRight size={20} color="#6B7280" />
        </Pressable>

        <View className="mb-4 rounded-3xl border border-neutral-200 bg-white">
          <Pressable onPress={() => setBudgetsOpen((v) => !v)} className="flex-row items-center px-4 py-3.5">
            <Text className="flex-1 text-base font-bold text-neutral-900">Category Budgets</Text>
            <ChevronDown size={28} color="#6B7280" style={{ transform: [{ rotate: budgetsOpen ? '180deg' : '0deg' }] }} />
          </Pressable>
          {budgetsOpen && month
            ? (month.activeCategories || []).map((category) => {
                const budget = month.categoryBudgets?.[category] || 0;
                const spent = calculateCategorySpent(month, category);
                const progress = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                return (
                  <View key={category} className="px-4 pb-3">
                    <View className="mb-1 flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <View className="mr-2 h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(0,104,95,0.1)' }}>
                          <CategoryIcon name={month.categoryIcons?.[category]} size={18} color={TEAL} />
                        </View>
                        <Text className="text-sm font-bold text-neutral-900">{category}</Text>
                      </View>
                      <Text className="font-mono text-sm font-bold text-neutral-500" style={{ fontFamily: FONT.monoBold }}>
                        {formatMoney(spent)}
                        {budget > 0 ? ` / ${formatMoney(budget)}` : ''}
                      </Text>
                    </View>
                    {budget > 0 ? (
                      <View className="h-2 overflow-hidden rounded-full bg-neutral-200">
                        <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: TEAL }} />
                      </View>
                    ) : null}
                  </View>
                );
              })
            : null}
        </View>

        <View className="mb-3 flex-row items-center rounded-xl border border-neutral-200 bg-white px-3" style={{ height: 48 }}>
          <Search size={20} color="#6B7280" />
          <TextInput
            className="ml-2 flex-1 text-sm text-neutral-900"
            placeholder="Search expenses or notes..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <HScroll horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ paddingRight: 16 }}>
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                className="mr-1.5 rounded-full px-3.5 py-1.5"
                style={{
                  backgroundColor: active ? TEAL : '#fff',
                  borderWidth: active ? 0 : 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <Text className={`text-xs ${active ? 'font-bold text-white' : 'font-semibold text-neutral-500'}`}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </HScroll>

        {filteredExpenses.length === 0 ? (
          <Text className="py-8 text-center text-sm text-neutral-400">No matching expenses.</Text>
        ) : (
          filteredExpenses.map((exp) => (
            <Pressable
              key={exp.id}
              onPress={() => {
                if (!canEdit) return;
                setEditingExpense(exp);
                setModalVisible(true);
              }}
              className="mb-2 flex-row items-center rounded-2xl border border-neutral-200 bg-white p-3"
            >
              <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(0,104,95,0.08)' }}>
                <CategoryIcon name={month?.categoryIcons?.[exp.type]} size={22} color={TEAL} />
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center">
                  <Text className="min-w-0 flex-1 text-base font-semibold text-neutral-900" numberOfLines={1}>
                    {exp.name}
                  </Text>
                  {exp.person && exp.person !== 'Self' ? (
                    <View className="ml-1.5 rounded-full bg-[#d9dff5] px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-[#404758]">{exp.person}</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="mt-0.5 text-[11px] text-neutral-500" numberOfLines={1}>
                  {exp.type} • {placeName(exp.place)} • {formatShortDate(exp.date)}
                </Text>
              </View>
              <View className="ml-2 shrink-0 flex-row items-baseline">
                <Text className="text-base font-extrabold font-mono text-neutral-900" style={{ fontFamily: FONT.monoBold }}>
                  -{formatMoney(exp.amount)}
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
        <ExpenseModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          month={month}
          currency={currency}
          expenseToEdit={editingExpense}
          onSave={handleSaveExpense}
          onDelete={async (expense) => {
            await updateMonth(deleteVariableExpense(month, expense));
          }}
        />
      ) : null}
    </View>
  );
}
