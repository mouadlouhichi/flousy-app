import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { type MoneyPlace, type MonthBudget } from '@flousy/core';

interface MoveMoneyModalProps {
  visible: boolean;
  onClose: () => void;
  month: MonthBudget;
  currency: string;
  onConfirm: (from: MoneyPlace, to: MoneyPlace, amount: number) => Promise<void>;
}

export function MoveMoneyModal({
  visible,
  onClose,
  month,
  currency,
  onConfirm,
}: MoveMoneyModalProps) {
  const { t } = useTranslation();
  const [fromPlace, setFromPlace] = useState<MoneyPlace>('bank');
  const [toPlace, setToPlace] = useState<MoneyPlace>('wallet');
  const [amountStr, setAmountStr] = useState('');
  const [loading, setLoading] = useState(false);

  const places: { id: MoneyPlace; label: string; balance: number }[] = [
    { id: 'bank', label: 'Bank Account', balance: month.bankPart || 0 },
    { id: 'home', label: 'Home Cash', balance: month.homePart || 0 },
    { id: 'wallet', label: 'Wallet', balance: month.walletPart || 0 },
  ];

  const handleTransfer = async () => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid transfer amount.');
      return;
    }
    if (fromPlace === toPlace) {
      Alert.alert('Invalid Transfer', 'Source and destination cannot be the same.');
      return;
    }

    const sourceObj = places.find((p) => p.id === fromPlace);
    if (!sourceObj || sourceObj.balance <= 0) {
      Alert.alert('No Funds', 'The source money place has zero balance.');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(fromPlace, toPlace, amount);
      setAmountStr('');
      onClose();
    } catch (err: any) {
      Alert.alert('Transfer Error', err?.message || 'Failed to move money');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6 space-y-5">
          <View className="flex-row justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              Move Money
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold text-base">Close</Text>
            </Pressable>
          </View>

          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Transfer cash between your money places. Total wealth is strictly conserved.
          </Text>

          <View className="space-y-4">
            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                From (Source)
              </Text>
              <View className="flex-row space-x-2">
                {places.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setFromPlace(p.id);
                      if (toPlace === p.id) {
                        setToPlace(p.id === 'bank' ? 'wallet' : 'bank');
                      }
                    }}
                    className={`flex-1 p-3 rounded-xl border items-center ${
                      fromPlace === p.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <Text
                      className={`font-semibold text-xs ${
                        fromPlace === p.id
                          ? 'text-primary'
                          : 'text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {p.label}
                    </Text>
                    <Text className="text-xs text-neutral-500 mt-1">
                      {p.balance} {currency}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                To (Destination)
              </Text>
              <View className="flex-row space-x-2">
                {places.map((p) => (
                  <Pressable
                    key={p.id}
                    disabled={p.id === fromPlace}
                    onPress={() => setToPlace(p.id)}
                    className={`flex-1 p-3 rounded-xl border items-center ${
                      p.id === fromPlace
                        ? 'opacity-40 bg-neutral-200 dark:bg-neutral-900 border-neutral-300'
                        : toPlace === p.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <Text
                      className={`font-semibold text-xs ${
                        toPlace === p.id
                          ? 'text-primary'
                          : 'text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {p.label}
                    </Text>
                    <Text className="text-xs text-neutral-500 mt-1">
                      {p.balance} {currency}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Amount to Move ({currency})
              </Text>
              <TextInput
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 font-bold text-lg"
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={amountStr}
                onChangeText={setAmountStr}
              />
            </View>
          </View>

          <View className="pt-4">
            <Pressable
              onPress={handleTransfer}
              disabled={loading}
              className="w-full bg-primary py-4 rounded-xl items-center justify-center shadow-sm"
            >
              <Text className="text-white font-bold text-base">
                {loading ? 'Moving...' : 'Confirm Transfer'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
