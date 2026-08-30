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
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { type FixedExpense, type MoneyPlace, type MonthBudget } from '@flousy/core';
import { MoneyPlaceChips } from './MoneyPlaceChips';
import { useMobileStore } from '../lib/store-context';

interface FixedModalProps {
  visible: boolean;
  onClose: () => void;
  month: MonthBudget;
  currency: string;
  billToEdit?: FixedExpense | null;
  onSave: (bill: FixedExpense) => Promise<void>;
  onDelete?: (bill: FixedExpense) => Promise<void>;
}

export function FixedModal({
  visible,
  onClose,
  month,
  currency,
  billToEdit,
  onSave,
  onDelete,
}: FixedModalProps) {
  const { t } = useTranslation();
  const { moneyPlaces } = useMobileStore();
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [place, setPlace] = useState<MoneyPlace>('bank');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [person, setPerson] = useState('');
  const [recurring, setRecurring] = useState(true);
  const [loading, setLoading] = useState(false);



  useEffect(() => {
    if (billToEdit) {
      setName(billToEdit.name);
      setAmountStr(String(billToEdit.amount));
      setPlace(billToEdit.place);
      setDate(billToEdit.date || new Date().toISOString().slice(0, 10));
      setPerson(billToEdit.person || '');
      setRecurring(billToEdit.recurring ?? true);
    } else {
      setName('');
      setAmountStr('');
      setPlace('bank');
      setDate(new Date().toISOString().slice(0, 10));
      setPerson('');
      setRecurring(true);
    }
  }, [billToEdit, visible]);

  const handleSave = async () => {
    const amount = parseFloat(amountStr);
    if (!name.trim() || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Bill', 'Please enter a valid bill name and amount.');
      return;
    }

    setLoading(true);
    try {
      const billData: FixedExpense = {
        id: billToEdit ? billToEdit.id : `fix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        amount,
        type: 'fixed',
        date: date || new Date().toISOString().slice(0, 10),
        place,
        base: amount,
        person: person.trim() || undefined,
        recurring,
      };

      await onSave(billData);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save bill');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!billToEdit || !onDelete) return;
    Alert.alert(
      'Delete Fixed Bill',
      `Delete "${billToEdit.name}" (${billToEdit.amount} ${currency})? The cash will be refunded to your ${billToEdit.place}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await onDelete(billToEdit);
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete bill');
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
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6 max-h-[85%]">
          <View className="flex-row justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              {billToEdit ? 'Edit Fixed Bill' : 'Add Fixed Bill'}
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold text-base">Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Bill Name
              </Text>
              <TextInput
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
                placeholder="e.g. Apartment Rent"
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

            <View className="flex-row justify-between items-center bg-neutral-100 dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700">
              <View>
                <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  Recurring Monthly Bill
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Carry over automatically when opening a fresh month
                </Text>
              </View>
              <Switch value={recurring} onValueChange={setRecurring} />
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
          </ScrollView>

          <View className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex-row space-x-3">
            {billToEdit && onDelete && (
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
                {loading ? 'Saving...' : billToEdit ? 'Save Changes' : 'Add Bill'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
