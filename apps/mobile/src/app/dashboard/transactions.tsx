import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  type VariableExpense,
  addVariableExpense,
  editVariableExpense,
  deleteVariableExpense,
  getDefaultCategoryNames,
} from '@flousy/core';
import { useMobileStore } from '../../lib/store-context';
import { ExpenseModal } from '../../components/ExpenseModal';

const DEFAULT_CURRENCY = 'MAD';

export default function TransactionsScreen() {
  const { t, i18n } = useTranslation();
  const { month, updateMonth } = useMobileStore();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<VariableExpense | null>(null);

  const currency = DEFAULT_CURRENCY;
  const expenses = month?.variableExpenses || [];
  const categories =
    month?.activeCategories && month.activeCategories.length > 0
      ? month.activeCategories
      : getDefaultCategoryNames(i18n.language as any);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (selectedCategory && exp.type !== selectedCategory) return false;
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchName = exp.name.toLowerCase().includes(query);
        const matchNote = exp.note?.toLowerCase().includes(query) || false;
        if (!matchName && !matchNote) return false;
      }
      return true;
    });
  }, [expenses, search, selectedCategory]);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (exp: VariableExpense) => {
    setEditingExpense(exp);
    setModalVisible(true);
  };

  const handleSaveExpense = async (expense: VariableExpense) => {
    if (!month) return;
    if (editingExpense) {
      const nextMonth = editVariableExpense(month, editingExpense, expense);
      await updateMonth(nextMonth);
    } else {
      const nextMonth = addVariableExpense(month, expense);
      await updateMonth(nextMonth);
    }
  };

  const handleDeleteExpense = async (expense: VariableExpense) => {
    if (!month) return;
    const nextMonth = deleteVariableExpense(month, expense);
    await updateMonth(nextMonth);
  };

  const totalFiltered = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <View className="p-4 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <View className="flex-row justify-between items-center mb-3">
          <View>
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              Variable Expenses
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              Total: {totalFiltered} {currency} ({filteredExpenses.length} items)
            </Text>
          </View>
          <Pressable
            onPress={handleOpenAdd}
            className="bg-primary px-4 py-2.5 rounded-xl shadow-sm"
          >
            <Text className="text-white font-bold text-sm">+ Expense</Text>
          </Pressable>
        </View>

        {/* Search Input */}
        <TextInput
          className="w-full bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 mb-3 text-sm"
          placeholder="Search by name or note..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />

        {/* Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row"
        >
          <Pressable
            onPress={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full mr-2 border ${
              selectedCategory === null
                ? 'bg-primary border-primary'
                : 'bg-neutral-100 dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                selectedCategory === null ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
              }`}
            >
              All Categories
            </Text>
          </Pressable>
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(active ? null : cat)}
                className={`px-3 py-1.5 rounded-full mr-2 border ${
                  active
                    ? 'bg-primary border-primary'
                    : 'bg-neutral-100 dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    active ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {filteredExpenses.length === 0 ? (
          <View className="bg-white dark:bg-neutral-800 p-8 rounded-2xl items-center justify-center border border-neutral-200 dark:border-neutral-700">
            <Text className="text-neutral-500 dark:text-neutral-400 font-semibold mb-1">
              No variable expenses found
            </Text>
            <Text className="text-xs text-neutral-400 text-center">
              {search || selectedCategory
                ? 'Try clearing filters or searching another term.'
                : 'Tap "+ Expense" to record your first variable purchase.'}
            </Text>
          </View>
        ) : (
          filteredExpenses.map((exp) => (
            <Pressable
              key={exp.id}
              onPress={() => handleOpenEdit(exp)}
              className="bg-white dark:bg-neutral-800 p-4 rounded-2xl mb-2.5 border border-neutral-200 dark:border-neutral-700 flex-row justify-between items-center shadow-xs"
            >
              <View className="flex-1 mr-3">
                <View className="flex-row items-center space-x-2 mb-0.5">
                  <Text className="font-bold text-base text-neutral-900 dark:text-white">
                    {exp.name}
                  </Text>
                  <View className="bg-primary/10 px-2 py-0.5 rounded-md">
                    <Text className="text-xs font-bold text-primary">
                      {exp.type}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-neutral-400">
                  Paid from: <Text className="font-semibold capitalize">{exp.place}</Text> • {exp.date}
                  {exp.person ? ` • ${exp.person}` : ''}
                </Text>
                {exp.note ? (
                  <Text className="text-xs text-neutral-500 italic mt-1" numberOfLines={1}>
                    "{exp.note}"
                  </Text>
                ) : null}
              </View>

              <View className="items-end">
                <Text className="font-extrabold text-lg text-neutral-900 dark:text-white">
                  -{exp.amount} {currency}
                </Text>
                <Text className="text-xs text-primary font-semibold">Tap to edit</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {month && (
        <ExpenseModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          month={month}
          currency={currency}
          expenseToEdit={editingExpense}
          onSave={handleSaveExpense}
          onDelete={handleDeleteExpense}
        />
      )}
    </View>
  );
}
