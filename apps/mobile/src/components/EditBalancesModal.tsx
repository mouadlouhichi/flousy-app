import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Sheet } from './Sheet';
import { X } from 'lucide-react-native';
import { type MoneyPlaceConfig, type MonthBudget, getPlaceBalance } from '@flousy/core';
import { formatMoney } from '../lib/format-money';

const TEAL = '#026462';

export function EditBalancesModal({
  visible,
  onClose,
  month,
  currency,
  places,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  month: MonthBudget;
  currency: string;
  places: MoneyPlaceConfig[];
  onSave: (values: Record<string, number>) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const next: Record<string, string> = {};
    for (const p of places) next[p.id] = String(getPlaceBalance(month, p.id));
    setDrafts(next);
  }, [visible, month, places]);

  const liveTotal = places.reduce((acc, p) => {
    const n = parseFloat(drafts[p.id] ?? '');
    return acc + (Number.isFinite(n) ? Math.max(0, n) : 0);
  }, 0);

  return (
    <Sheet visible={visible} onClose={onClose}>
        <View className="max-h-[92%] rounded-t-[28px] bg-[#F5FAF8] px-5 pb-8 pt-3">
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-neutral-300" />
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-extrabold text-neutral-900">Edit Money Balances</Text>
            <Pressable onPress={onClose} className="p-1">
              <X size={22} color="#374151" />
            </Pressable>
          </View>
          <Text className="mb-4 text-sm leading-5 text-neutral-500">
            Correct your current cash in each place. This adjusts your cash on hand — your monthly
            budget stays unchanged.
          </Text>
          <ScrollView>
            {places.map((p) => (
              <View key={p.id} className="mb-3 rounded-2xl border border-neutral-200 bg-white p-3">
                <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
                  {p.name}
                </Text>
                <View className="flex-row items-center rounded-xl border border-neutral-200 bg-[#F5FAF8] px-3 py-2">
                  <Text className="mr-2 text-lg font-bold" style={{ color: TEAL }}>
                    {currency}
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={drafts[p.id] ?? ''}
                    onChangeText={(v) => setDrafts((prev) => ({ ...prev, [p.id]: v.replace(/[^0-9.]/g, '') }))}
                    className="flex-1 text-lg font-semibold text-neutral-900"
                  />
                </View>
              </View>
            ))}
            <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <View>
                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
                  Total cash on hand
                </Text>
                <Text className="text-[11px] font-bold text-neutral-500">
                  Monthly budget: {currency} {formatMoney(month.totalBudget)}
                </Text>
              </View>
              <Text className="text-lg font-extrabold" style={{ color: TEAL }}>
                {currency} {formatMoney(liveTotal)}
              </Text>
            </View>
          </ScrollView>
          <View className="mt-2 flex-row gap-2">
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-xl border border-neutral-200 bg-white py-3.5"
            >
              <Text className="font-bold text-neutral-600">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                const values: Record<string, number> = {};
                for (const p of places) {
                  const n = parseFloat(drafts[p.id] ?? '');
                  values[p.id] = Number.isFinite(n) ? Math.max(0, n) : getPlaceBalance(month, p.id);
                }
                setSaving(true);
                try {
                  await onSave(values);
                  onClose();
                } finally {
                  setSaving(false);
                }
              }}
              className="flex-1 items-center rounded-xl py-3.5"
              style={{ backgroundColor: TEAL, opacity: saving ? 0.6 : 1 }}
            >
              <Text className="font-bold text-white">{saving ? 'Saving…' : 'Save balances'}</Text>
            </Pressable>
          </View>
        </View>
    </Sheet>
  );
}
