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
import { Sheet } from './Sheet';
import { useTranslation } from 'react-i18next';
import {
  type VariableExpense,
  type MoneyPlace,
  type MonthBudget,
  getDefaultCategoryNames,
} from '@flousy/core';
import { MoneyPlaceChips } from './MoneyPlaceChips';
import { useMobileStore } from '../lib/store-context';

interface ExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  month: MonthBudget;
  currency: string;
  expenseToEdit?: VariableExpense | null;
  onSave: (expense: VariableExpense) => Promise<void>;
  onDelete?: (expense: VariableExpense) => Promise<void>;
}

export function ExpenseModal({
  visible,
  onClose,
  month,
  currency,
  expenseToEdit,
  onSave,
  onDelete,
}: ExpenseModalProps) {
  const { t, i18n } = useTranslation();
  const { moneyPlaces } = useMobileStore();
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState('');
  const [place, setPlace] = useState<MoneyPlace>('bank');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [person, setPerson] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const categories =
    month.activeCategories && month.activeCategories.length > 0
      ? month.activeCategories
      : getDefaultCategoryNames(i18n.language as any);



  useEffect(() => {
    if (expenseToEdit) {
      setName(expenseToEdit.name);
      setAmountStr(String(expenseToEdit.amount));
      setCategory(expenseToEdit.type);
      setPlace(expenseToEdit.place);
      setDate(expenseToEdit.date);
      setPerson(expenseToEdit.person || '');
      setNote(expenseToEdit.note || '');
    } else {
      setName('');
      setAmountStr('');
      setCategory(categories[0] || 'Other');
      setPlace('bank');
      setDate(new Date().toISOString().slice(0, 10));
      setPerson('');
      setNote('');
    }
  }, [expenseToEdit, visible]);

  const handleSave = async () => {
    const amount = parseFloat(amountStr);
    if (!name.trim() || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Expense', 'Please enter a valid expense name and amount.');
      return;
    }
    if (!category) {
      Alert.alert('Missing Category', 'Please select a category.');
      return;
    }

    setLoading(true);
    try {
      const expenseData: VariableExpense = {
        id: expenseToEdit ? expenseToEdit.id : `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        amount,
        type: category,
        date: date || new Date().toISOString().slice(0, 10),
        place,
        person: person.trim() || undefined,
        note: note.trim() || undefined,
      };

      await onSave(expenseData);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!expenseToEdit || !onDelete) return;
    Alert.alert(
      'Delete Expense',
      `Delete "${expenseToEdit.name}" (${expenseToEdit.amount} ${currency})? The cash will be returned to your ${expenseToEdit.place}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await onDelete(expenseToEdit);
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete expense');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6 max-h-[85%]">
          <View className="flex-row justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              {expenseToEdit ? 'Edit Variable Expense' : 'Add Variable Expense'}
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold text-base">Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Description
              </Text>
              <TextInput
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
                placeholder="e.g. Grocery Shopping"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View className="flex-row space-x-2">
              <View className="flex-1">
                <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Amount ({currency})
                </Text>
                <TextInput
                  className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 font-bold"
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={amountStr}
                  onChangeText={setAmountStr}
                />
              </View>
              <View className="w-40">
                <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Date
                </Text>
                <TextInput
                  className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-3 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-center text-sm font-mono"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                  value={date}
                  onChangeText={setDate}
                />
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Paid From (Money Place)
              </Text>
              <MoneyPlaceChips
                month={month}
                selected={place}
                onSelect={setPlace}
                currency={currency}
                places={moneyPlaces}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Category
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {categories.map((cat) => {
                  const selected = category === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      className={`px-3.5 py-2 rounded-xl border ${
                        selected
                          ? 'bg-primary border-primary'
                          : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          selected
                            ? 'text-white'
                            : 'text-neutral-800 dark:text-neutral-200'
                        }`}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Person / Household Member (Optional)
              </Text>
              <TextInput
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
                placeholder="e.g. Mouad"
                placeholderTextColor="#9ca3af"
                value={person}
                onChangeText={setPerson}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Note (Optional)
              </Text>
              <TextInput
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
                placeholder="Additional details..."
                placeholderTextColor="#9ca3af"
                value={note}
                onChangeText={setNote}
              />
            </View>
          </ScrollView>

          <View className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex-row space-x-3">
            {expenseToEdit && onDelete && (
              <Pressable
                onPress={handleDelete}
                disabled={loading}
                className="flex-1 bg-red-500/10 border border-red-500/30 py-3.5 rounded-xl items-center justify-center"
              >
                <Text className="text-red-500 font-bold text-base">Delete</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleSave}
              disabled={loading}
              className="flex-2 bg-primary py-3.5 rounded-xl items-center justify-center shadow-sm flex-1"
            >
              <Text className="text-white font-bold text-base">
                {loading ? 'Saving...' : expenseToEdit ? 'Save Changes' : 'Add Expense'}
              </Text>
            </Pressable>
          </View>
        </View>
    </Sheet>
  );
}
