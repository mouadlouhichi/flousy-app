import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Sheet } from './Sheet';
import {
  type MoneyPlaceConfig,
  type UserProfile,
  type MonthBudget,
  type SavingGoal,
  addMoneyPlace,
  updateMoneyPlace,
  removeMoneyPlace,
  reassignMoneyPlace,
  reassignGoalSources,
  nextMoneyPlaceId,
  MONEY_PLACE_ICON_CHOICES,
} from '@flousy/core';
import { useMobileStore } from '../lib/store-context';

export function MoneyPlacesModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { profile, moneyPlaces, month, savingsGoals, updateProfile, updateMonth, updateSavingsGoals } =
    useMobileStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(MONEY_PLACE_ICON_CHOICES[0]);

  const persistPlaces = async (nextProfile: UserProfile, nextMonth?: MonthBudget, nextGoals?: SavingGoal[]) => {
    await updateProfile({ moneyPlaces: nextProfile.moneyPlaces });
    if (nextMonth) await updateMonth(nextMonth);
    if (nextGoals) await updateSavingsGoals(nextGoals);
  };

  const handleAdd = async () => {
    if (!profile || !name.trim()) return;
    const id = nextMoneyPlaceId(name, moneyPlaces.map((p) => p.id));
    const next = addMoneyPlace(profile, { id, name: name.trim(), icon });
    await persistPlaces(next);
    setName('');
  };

  const handleRename = async (place: MoneyPlaceConfig, newName: string) => {
    if (!profile) return;
    const next = updateMoneyPlace(profile, place.id, { name: newName });
    await persistPlaces(next);
  };

  const handleRemove = async (place: MoneyPlaceConfig) => {
    if (!profile || !month) return;
    if (moneyPlaces.length <= 1) {
      Alert.alert('Keep one place', 'You need at least one money place.');
      return;
    }
    const fallback = moneyPlaces.find((p) => p.id !== place.id)!.id;
    Alert.alert(
      'Remove money place',
      `Cash in ${place.name} will move to ${moneyPlaces.find((p) => p.id === fallback)?.name}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const nextProfile = removeMoneyPlace(profile, place.id);
            const nextMonth = reassignMoneyPlace(month, place.id, fallback);
            const nextGoals = reassignGoalSources(savingsGoals, place.id, fallback);
            await persistPlaces(nextProfile, nextMonth, nextGoals);
          },
        },
      ],
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6 max-h-[88%]">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">Money Places</Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold">Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            {moneyPlaces.map((place) => (
              <View
                key={place.id}
                className="flex-row items-center justify-between py-3 border-b border-neutral-100 dark:border-neutral-800"
              >
                <View className="flex-1 mr-3">
                  <Text className="font-semibold text-neutral-900 dark:text-white">{place.name}</Text>
                  <Text className="text-xs text-neutral-400">{place.id}</Text>
                </View>
                <Pressable onPress={() => handleRemove(place)} className="px-3 py-1.5">
                  <Text className="text-red-500 text-xs font-bold">Remove</Text>
                </Pressable>
              </View>
            ))}
            <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mt-4 mb-2">Add a place</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. PayPal"
              placeholderTextColor="#9ca3af"
              className="bg-neutral-100 dark:bg-neutral-800 px-4 py-3 rounded-xl text-neutral-900 dark:text-white mb-3"
            />
            <Pressable onPress={handleAdd} className="bg-primary py-3 rounded-xl items-center">
              <Text className="text-white font-bold">Add Place</Text>
            </Pressable>
          </ScrollView>
        </View>
    </Sheet>
  );
}
