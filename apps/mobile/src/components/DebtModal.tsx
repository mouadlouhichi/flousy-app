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
import {
  type DebtItem,
  type DebtType,
  type DebtStatus,
} from '@flousy/core';

interface DebtModalProps {
  visible: boolean;
  onClose: () => void;
  currency: string;
  debtToEdit?: DebtItem | null;
  onSave: (debt: DebtItem) => Promise<void>;
  onDelete?: (debtId: string) => Promise<void>;
}

export function DebtModal({
  visible,
  onClose,
  currency,
  debtToEdit,
  onSave,
  onDelete,
}: DebtModalProps) {
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [type, setType] = useState<DebtType>('debt');
  const [status, setStatus] = useState<DebtStatus>('open');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (debtToEdit) {
      setName(debtToEdit.name);
      setAmountStr(String(debtToEdit.amount));
      setType(debtToEdit.type);
      setStatus(debtToEdit.status);
      setDate(debtToEdit.date);
      setNote(debtToEdit.note || '');
    } else {
      setName('');
      setAmountStr('');
      setType('debt');
      setStatus('open');
      setDate(new Date().toISOString().slice(0, 10));
      setNote('');
    }
  }, [debtToEdit, visible]);

  const handleSave = async () => {
    const amount = parseFloat(amountStr);
    if (!name.trim() || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Entry', 'Please enter a valid person/entity name and amount.');
      return;
    }

    setLoading(true);
    try {
      const debtData: DebtItem = {
        id: debtToEdit ? debtToEdit.id : `debt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        amount,
        type,
        status,
        date: date || new Date().toISOString().slice(0, 10),
        note: note.trim() || undefined,
      };

      await onSave(debtData);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save debt/credit');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!debtToEdit || !onDelete) return;
    Alert.alert(
      'Delete Record',
      `Delete record for "${debtToEdit.name}" (${debtToEdit.amount} ${currency})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await onDelete(debtToEdit.id);
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete record');
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
              {debtToEdit ? 'Edit Debt/Credit' : 'Record Debt/Credit'}
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold text-base">Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Type
              </Text>
              <View className="flex-row space-x-2">
                <Pressable
                  onPress={() => setType('debt')}
                  className={`flex-1 p-3 rounded-xl border items-center ${
                    type === 'debt'
                      ? 'bg-red-500/10 border-red-500'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <Text
                    className={`font-bold text-xs ${
                      type === 'debt' ? 'text-red-600' : 'text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    I Owe (Debt)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setType('credit')}
                  className={`flex-1 p-3 rounded-xl border items-center ${
                    type === 'credit'
                      ? 'bg-emerald-500/10 border-emerald-500'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <Text
                    className={`font-bold text-xs ${
                      type === 'credit'
                        ? 'text-emerald-600'
                        : 'text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    Owed to Me (Credit)
                  </Text>
                </Pressable>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Person / Entity Name
              </Text>
              <TextInput
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
                placeholder="e.g. Karim or Bank Loan"
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
                Status
              </Text>
              <View className="flex-row space-x-2">
                <Pressable
                  onPress={() => setStatus('open')}
                  className={`flex-1 p-2.5 rounded-xl border items-center ${
                    status === 'open'
                      ? 'bg-amber-500/10 border-amber-500'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <Text
                    className={`font-semibold text-xs ${
                      status === 'open' ? 'text-amber-600' : 'text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    Open (Pending)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setStatus('settled')}
                  className={`flex-1 p-2.5 rounded-xl border items-center ${
                    status === 'settled'
                      ? 'bg-blue-500/10 border-blue-500'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <Text
                    className={`font-semibold text-xs ${
                      status === 'settled' ? 'text-blue-600' : 'text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    Settled (Paid)
                  </Text>
                </Pressable>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Note (Optional)
              </Text>
              <TextInput
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
                placeholder="Additional info..."
                placeholderTextColor="#9ca3af"
                value={note}
                onChangeText={setNote}
              />
            </View>
          </ScrollView>

          <View className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex-row space-x-3">
            {debtToEdit && onDelete && (
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
                {loading ? 'Saving...' : debtToEdit ? 'Save Changes' : 'Record'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
