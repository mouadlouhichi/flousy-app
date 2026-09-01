import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Pencil, Trash2, Plus } from 'lucide-react-native';
import {
  MONEY_PLACE_ICON_CHOICES,
  addMoneyPlace,
  getPlaceBalance,
  nextMoneyPlaceId,
  reassignGoalSources,
  reassignMoneyPlace,
  removeMoneyPlace,
  updateMoneyPlace,
} from '@flousy/core';
import { ProfileSubpage } from '../../components/ProfileSubpage';
import { CategoryIcon } from '../../components/CategoryIcon';
import { useMobileStore } from '../../lib/store-context';
import { formatMoney } from '../../lib/format-money';
import { FONT } from '../../lib/fonts';

const TEAL = '#00685f';

export default function MoneySourcesScreen() {
  const { profile, moneyPlaces, month, savingsGoals, currency, updateProfile, updateMonth, updateSavingsGoals } =
    useMobileStore();
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftIcon, setDraftIcon] = useState<string>('payments');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('payments');

  const persistPlaces = async (nextProfile: typeof profile) => {
    if (!nextProfile) return;
    await updateProfile({ moneyPlaces: nextProfile.moneyPlaces });
  };

  const handleAdd = async () => {
    if (!profile) return;
    const name = draftName.trim();
    if (!name) {
      Alert.alert('Name required', 'Give this money source a name.');
      return;
    }
    const id = nextMoneyPlaceId(name, moneyPlaces.map((p) => p.id));
    const next = addMoneyPlace(profile, { id, name, icon: draftIcon });
    if (next === profile) {
      Alert.alert('Already used', 'That name is already used.');
      return;
    }
    await persistPlaces(next);
    setDraftName('');
    setDraftIcon('payments');
    setAdding(false);
  };

  const handleSaveEdit = async () => {
    if (!profile || !editingId) return;
    const next = updateMoneyPlace(profile, editingId, { name: editName, icon: editIcon });
    if (next === profile) {
      Alert.alert('Invalid name', 'Enter a unique name.');
      return;
    }
    await persistPlaces(next);
    setEditingId(null);
  };

  const handleRemove = (id: string) => {
    if (!profile || !month) return;
    const remaining = moneyPlaces.filter((p) => p.id !== id);
    if (remaining.length === 0) return;
    const fallback = remaining[0];
    const place = moneyPlaces.find((p) => p.id === id);
    const leftover = getPlaceBalance(month, id);
    Alert.alert(
      `Remove ${place?.name || 'this source'}?`,
      leftover > 0
        ? `${formatMoney(leftover)} ${currency} in ${place?.name} will move to ${fallback.name}.`
        : 'You must keep at least one money source.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const nextProfile = removeMoneyPlace(profile, id);
            await persistPlaces(nextProfile);
            await updateMonth(reassignMoneyPlace(month, id, fallback.id));
            await updateSavingsGoals(reassignGoalSources(savingsGoals, id, fallback.id));
          },
        },
      ],
    );
  };

  return (
    <ProfileSubpage title="Money sources">
      <Text className="mb-3 text-sm text-neutral-500">
        These are the cash locations you spend from — Bank, Home, Wallet, or any jar you add.
      </Text>
      <View className="mb-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {moneyPlaces.map((place, index) => {
          const isEditing = editingId === place.id;
          const balance = month ? getPlaceBalance(month, place.id) : 0;
          return (
            <View key={place.id} className="p-4" style={index > 0 ? { borderTopWidth: 1, borderTopColor: '#F3F4F6' } : undefined}>
              <View className="flex-row items-center">
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(0,104,95,0.1)' }}>
                  <CategoryIcon name={place.icon} size={20} color={TEAL} />
                </View>
                <View className="min-w-0 flex-1">
                  {isEditing ? (
                    <TextInput
                      value={editName}
                      onChangeText={setEditName}
                      autoFocus
                      className="rounded-lg border border-neutral-200 bg-[#F5FAF8] px-3 py-1.5 text-sm font-bold text-neutral-900"
                    />
                  ) : (
                    <>
                      <Text className="text-sm font-bold text-neutral-900">{place.name}</Text>
                      <Text className="font-mono text-xs text-neutral-500" style={{ fontFamily: FONT.mono }}>
                        {formatMoney(balance)} {currency}
                      </Text>
                    </>
                  )}
                </View>
                {!isEditing ? (
                  <View className="flex-row">
                    <Pressable
                      onPress={() => {
                        setEditingId(place.id);
                        setEditName(place.name);
                        setEditIcon(place.icon);
                      }}
                      className="h-8 w-8 items-center justify-center"
                    >
                      <Pencil size={16} color="#6B7280" />
                    </Pressable>
                    <Pressable
                      disabled={moneyPlaces.length <= 1}
                      onPress={() => handleRemove(place.id)}
                      className="h-8 w-8 items-center justify-center"
                    >
                      <Trash2 size={16} color={moneyPlaces.length <= 1 ? '#D1D5DB' : '#EF4444'} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
              {isEditing ? (
                <View className="mt-3">
                  <IconPicker value={editIcon} onChange={setEditIcon} />
                  <View className="mt-3 flex-row gap-2">
                    <Pressable onPress={handleSaveEdit} className="flex-1 items-center rounded-xl py-2" style={{ backgroundColor: TEAL }}>
                      <Text className="text-xs font-bold text-white">Save</Text>
                    </Pressable>
                    <Pressable onPress={() => setEditingId(null)} className="flex-1 items-center rounded-xl border border-neutral-200 py-2">
                      <Text className="text-xs font-bold text-neutral-500">Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {adding ? (
        <View className="rounded-2xl border border-neutral-200 bg-white p-4">
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="e.g. PayPal, Safe, Revolut"
            placeholderTextColor="#9CA3AF"
            className="rounded-xl border border-neutral-200 bg-[#F5FAF8] px-3 py-2 text-sm font-bold text-neutral-900"
          />
          <View className="mt-3">
            <IconPicker value={draftIcon} onChange={setDraftIcon} />
          </View>
          <View className="mt-3 flex-row gap-2">
            <Pressable onPress={handleAdd} className="flex-1 items-center rounded-xl py-2.5" style={{ backgroundColor: TEAL }}>
              <Text className="text-sm font-bold text-white">Add source</Text>
            </Pressable>
            <Pressable onPress={() => setAdding(false)} className="flex-1 items-center rounded-xl border border-neutral-200 py-2.5">
              <Text className="text-sm font-bold text-neutral-500">Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          className="flex-row items-center justify-center rounded-2xl border border-dashed border-neutral-300 py-3.5"
        >
          <Plus size={18} color={TEAL} />
          <Text className="ml-2 text-sm font-bold" style={{ color: TEAL }}>
            Add money source
          </Text>
        </Pressable>
      )}
    </ProfileSubpage>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {MONEY_PLACE_ICON_CHOICES.map((icon) => {
        const active = value === icon;
        return (
          <Pressable
            key={icon}
            onPress={() => onChange(icon)}
            className="h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: active ? TEAL : '#F3F4F6' }}
          >
            <CategoryIcon name={icon} size={18} color={active ? '#fff' : '#6B7280'} />
          </Pressable>
        );
      })}
    </View>
  );
}
