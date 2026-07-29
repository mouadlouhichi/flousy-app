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
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { type MonthBudget, getDefaultCategoryNames } from '@flousy/core';

interface CategoriesModalProps {
  visible: boolean;
  onClose: () => void;
  month: MonthBudget;
  onUpdateMonth: (nextMonth: MonthBudget) => Promise<void>;
}

export function CategoriesModal({
  visible,
  onClose,
  month,
  onUpdateMonth,
}: CategoriesModalProps) {
  const { i18n } = useTranslation();
  const [newCatName, setNewCatName] = useState('');
  const [loading, setLoading] = useState(false);

  const categories =
    month.activeCategories && month.activeCategories.length > 0
      ? month.activeCategories
      : getDefaultCategoryNames(i18n.language as any);

  const handleAddCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      Alert.alert('Invalid Name', 'Please enter a category name.');
      return;
    }
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Duplicate Category', 'This category already exists.');
      return;
    }

    setLoading(true);
    try {
      const updatedCategories = [...categories, trimmed];
      const nextMonth: MonthBudget = {
        ...month,
        activeCategories: updatedCategories,
      };
      await onUpdateMonth(nextMonth);
      setNewCatName('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add category.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCategory = async (catName: string) => {
    if (categories.length <= 1) {
      Alert.alert('Cannot Remove', 'You must have at least one active category.');
      return;
    }

    setLoading(true);
    try {
      const updatedCategories = categories.filter((c) => c !== catName);
      const nextMonth: MonthBudget = {
        ...month,
        activeCategories: updatedCategories,
      };
      await onUpdateMonth(nextMonth);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to remove category.');
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
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6 max-h-[85%]">
          <View className="flex-row justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              Manage Categories
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold text-base">Close</Text>
            </Pressable>
          </View>

          <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            Add custom categories or customize active budgeting envelopes.
          </Text>

          <View className="flex-row space-x-2 mb-4">
            <TextInput
              className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm"
              placeholder="New category name (e.g. Travel)"
              placeholderTextColor="#9ca3af"
              value={newCatName}
              onChangeText={setNewCatName}
            />
            <Pressable
              onPress={handleAddCategory}
              disabled={loading}
              className="bg-primary px-5 py-3 rounded-xl items-center justify-center"
            >
              <Text className="text-white font-bold text-sm">+ Add</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="space-y-2">
            {categories.map((cat) => (
              <View
                key={cat}
                className="bg-neutral-50 dark:bg-neutral-800 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 flex-row justify-between items-center"
              >
                <Text className="font-bold text-neutral-900 dark:text-white">{cat}</Text>
                {categories.length > 1 && (
                  <Pressable onPress={() => handleRemoveCategory(cat)}>
                    <Text className="text-red-500 font-bold text-sm">Remove</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
