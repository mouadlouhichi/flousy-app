import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  STRATEGIES,
  type StrategyId,
  type CustomRatios,
  type MonthBudget,
  normalizeCustomRatios,
  updateBudgetStrategy,
} from '@flousy/core';

const PRESETS: StrategyId[] = ['50-30-20', '70-20-10', '80-20', 'zero-based', 'envelope', 'pay-first', 'custom'];

export function StrategyModal({
  visible,
  onClose,
  month,
  onUpdateMonth,
}: {
  visible: boolean;
  onClose: () => void;
  month: MonthBudget;
  onUpdateMonth: (month: MonthBudget) => Promise<void>;
}) {
  const [strategyId, setStrategyId] = useState<StrategyId>(month.strategyId);
  const [needs, setNeeds] = useState('50');
  const [wants, setWants] = useState('30');
  const [savings, setSavings] = useState('20');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStrategyId(month.strategyId);
    const ratios = normalizeCustomRatios(month.customRatios);
    setNeeds(String(Math.round(ratios.needs * 100)));
    setWants(String(Math.round(ratios.wants * 100)));
    setSavings(String(Math.round(ratios.savings * 100)));
  }, [visible, month]);

  const custom: CustomRatios = normalizeCustomRatios({
    needs: Number(needs) / 100,
    wants: Number(wants) / 100,
    savings: Number(savings) / 100,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateMonth(updateBudgetStrategy(month, strategyId, strategyId === 'custom' ? custom : undefined));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6 max-h-[88%]">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">Budget Strategy</Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold">Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            {PRESETS.map((id) => {
              const s = STRATEGIES[id];
              const active = strategyId === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setStrategyId(id)}
                  className={`p-3.5 rounded-2xl border mb-2 ${
                    active ? 'border-primary bg-primary/10' : 'border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <Text className={`font-bold ${active ? 'text-primary' : 'text-neutral-900 dark:text-white'}`}>
                    {s.name}
                  </Text>
                  <Text className="text-xs text-neutral-500 mt-1">{s.description}</Text>
                </Pressable>
              );
            })}
            {strategyId === 'custom' && (
              <View className="mt-2 mb-4">
                <Text className="text-xs text-neutral-500 mb-2">
                  Custom split (must total 100%). Savings absorbs remainder.
                </Text>
                <View className="flex-row gap-2">
                  {[
                    ['Needs', needs, setNeeds],
                    ['Wants', wants, setWants],
                    ['Savings', savings, setSavings],
                  ].map(([label, value, setter]) => (
                    <View key={label as string} className="flex-1">
                      <Text className="text-xs font-medium text-neutral-600 mb-1">{label as string} %</Text>
                      <TextInput
                        keyboardType="numeric"
                        value={value as string}
                        onChangeText={setter as (v: string) => void}
                        className="bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl text-neutral-900 dark:text-white"
                      />
                    </View>
                  ))}
                </View>
                <Text className="text-xs text-neutral-400 mt-2">
                  Applied: {Math.round(custom.needs * 100)} / {Math.round(custom.wants * 100)} / {Math.round(custom.savings * 100)}
                </Text>
              </View>
            )}
          </ScrollView>
          <Pressable onPress={handleSave} disabled={saving} className="bg-primary py-3.5 rounded-xl items-center mt-3">
            <Text className="text-white font-bold">{saving ? 'Saving…' : 'Apply Strategy'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
