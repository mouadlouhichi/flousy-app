import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  PieChart,
  Shield,
  SlidersHorizontal,
  LayoutGrid,
  Mail,
  PiggyBank,
  Check,
  X,
} from 'lucide-react-native';
import {
  STRATEGIES,
  type StrategyId,
  type CustomRatios,
  type MonthBudget,
  calculateEnvelopeAmounts,
  normalizeCustomRatios,
  resolveStrategy,
  updateBudgetStrategy,
} from '@flousy/core';
import { Sheet } from './Sheet';
import { formatMoney } from '../lib/format-money';

const TEAL = '#026462';

const PRESETS: StrategyId[] = ['50-30-20', '70-20-10', '80-20', 'zero-based', 'envelope', 'pay-first'];

const ICONS: Record<string, typeof PieChart> = {
  '50-30-20': PieChart,
  '70-20-10': Shield,
  '80-20': SlidersHorizontal,
  'zero-based': LayoutGrid,
  envelope: Mail,
  'pay-first': PiggyBank,
  custom: SlidersHorizontal,
};

const TAGS: Record<StrategyId, { label: string; bg: string; color: string }> = {
  '50-30-20': { label: 'Popular', bg: 'rgba(2,100,98,0.1)', color: TEAL },
  '70-20-10': { label: 'Beginner', bg: '#EFF6FF', color: '#1D4ED8' },
  '80-20': { label: 'Simple', bg: '#FFFBEB', color: '#B45309' },
  'zero-based': { label: 'Detailed', bg: '#F5F3FF', color: '#6D28D9' },
  envelope: { label: 'Visual', bg: '#FFF7ED', color: '#C2410C' },
  'pay-first': { label: 'Saver', bg: '#ECFDF5', color: '#047857' },
  custom: { label: 'Yours', bg: 'rgba(2,100,98,0.1)', color: TEAL },
};

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
  const [previewId, setPreviewId] = useState<StrategyId>(month.strategyId);
  const [split, setSplit] = useState({ needs: 50, wants: 30, savings: 20 });
  const [customOpen, setCustomOpen] = useState(month.strategyId === 'custom');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPreviewId(month.strategyId);
    const r = normalizeCustomRatios(month.customRatios);
    setSplit({
      needs: Math.round(r.needs * 100),
      wants: Math.round(r.wants * 100),
      savings: Math.round(r.savings * 100),
    });
    setCustomOpen(month.strategyId === 'custom');
  }, [visible, month]);

  const draftCustom = useMemo<CustomRatios>(
    () => normalizeCustomRatios({ needs: split.needs / 100, wants: split.wants / 100, savings: split.savings / 100 }),
    [split],
  );
  const previewRatios = previewId === 'custom' ? draftCustom : undefined;
  const previewStrategy = resolveStrategy(previewId, previewRatios);
  const preview = calculateEnvelopeAmounts(month.totalBudget, previewId, previewRatios);

  const apply = async (id: StrategyId, ratios?: CustomRatios) => {
    setSaving(true);
    try {
      await onUpdateMonth(updateBudgetStrategy(month, id, id === 'custom' ? ratios : undefined));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View className="max-h-[92%] rounded-t-[28px] bg-[#F5FAF8] px-5 pb-8 pt-3">
        <View className="mb-3 h-1 w-10 self-center rounded-full bg-neutral-300" />
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-xl font-extrabold text-neutral-900">Choose Budget Strategy</Text>
          <Pressable onPress={onClose} hitSlop={12} className="p-1">
            <X size={22} color="#374151" />
          </Pressable>
        </View>

        <View className="mb-4 rounded-2xl border border-primary/20 p-4" style={{ backgroundColor: 'rgba(2,100,98,0.06)' }}>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
              Preview allocation
            </Text>
            <Text className="text-sm font-extrabold" style={{ color: TEAL }}>
              {formatMoney(month.totalBudget)}
            </Text>
          </View>
          <View className="mb-3 h-3 flex-row overflow-hidden rounded-full bg-neutral-200">
            <View style={{ width: `${previewStrategy.needsRatio * 100}%`, backgroundColor: TEAL }} />
            <View style={{ width: `${previewStrategy.wantsRatio * 100}%`, backgroundColor: '#F59E0B' }} />
            <View style={{ width: `${previewStrategy.savingsRatio * 100}%`, backgroundColor: '#475569' }} />
          </View>
          <View className="flex-row gap-2">
            {[
              { label: 'Needs', value: preview.needs, color: TEAL },
              { label: 'Wants', value: preview.wants, color: '#F59E0B' },
              { label: 'Savings', value: preview.savings, color: '#475569' },
            ].map((item) => (
              <View key={item.label} className="min-w-0 flex-1 rounded-lg bg-white/70 px-2 py-1.5">
                <View className="flex-row items-center">
                  <View className="mr-1 h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <Text className="text-[10px] font-bold text-neutral-500">{item.label}</Text>
                </View>
                <Text className="text-[12px] font-extrabold text-neutral-900">{formatMoney(item.value)}</Text>
              </View>
            ))}
          </View>
        </View>

        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          {PRESETS.map((id) => {
            const s = STRATEGIES[id];
            const selected = month.strategyId === id;
            const Icon = ICONS[id] || PieChart;
            const tag = TAGS[id];
            const amounts = calculateEnvelopeAmounts(month.totalBudget, id);
            return (
              <Pressable
                key={id}
                onPress={() => apply(id)}
                onPressIn={() => setPreviewId(id)}
                className="mb-2.5 rounded-2xl border-2 bg-white p-4"
                style={{ borderColor: selected ? TEAL : '#E5E7EB', backgroundColor: selected ? 'rgba(2,100,98,0.05)' : '#fff' }}
              >
                <View className="flex-row items-start">
                  <View
                    className="mr-3 h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: selected ? TEAL : '#F3F4F6' }}
                  >
                    <Icon size={20} color={selected ? '#fff' : TEAL} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <View className="mb-0.5 flex-row flex-wrap items-center">
                      <Text className="mr-2 text-base font-extrabold text-neutral-900">{s.name}</Text>
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: tag.bg }}>
                        <Text className="text-[10px] font-bold" style={{ color: tag.color }}>
                          {tag.label}
                        </Text>
                      </View>
                    </View>
                    <Text className="mb-2 text-[12px] font-medium leading-4 text-neutral-500">{s.description}</Text>
                    <View className="mb-2 h-2 flex-row overflow-hidden rounded-full bg-neutral-100">
                      <View style={{ width: `${s.needsRatio * 100}%`, backgroundColor: TEAL }} />
                      <View style={{ width: `${s.wantsRatio * 100}%`, backgroundColor: '#F59E0B' }} />
                      <View style={{ width: `${s.savingsRatio * 100}%`, backgroundColor: '#475569' }} />
                    </View>
                    <View className="flex-row gap-1">
                      {[
                        { label: 'Needs', pct: s.needsRatio, value: amounts.needs },
                        { label: 'Wants', pct: s.wantsRatio, value: amounts.wants },
                        { label: 'Savings', pct: s.savingsRatio, value: amounts.savings },
                      ].map((cell) => (
                        <View key={cell.label} className="min-w-0 flex-1 rounded-md bg-[#F5FAF8] px-1.5 py-1.5">
                          <Text className="text-[9px] font-bold text-neutral-500" numberOfLines={1}>
                            {cell.label} · {Math.round(cell.pct * 100)}%
                          </Text>
                          <Text className="text-[10px] font-extrabold text-neutral-800">{formatMoney(cell.value)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View className="ml-2 mt-1">
                    {selected ? (
                      <View className="h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: TEAL }}>
                        <Check size={12} color="#fff" />
                      </View>
                    ) : (
                      <View className="h-5 w-5 rounded-full border-2 border-neutral-300" />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}

          <View
            className="mb-2 rounded-2xl border-2 bg-white"
            style={{
              borderColor: month.strategyId === 'custom' || customOpen ? TEAL : '#E5E7EB',
              backgroundColor: month.strategyId === 'custom' ? 'rgba(2,100,98,0.05)' : '#fff',
            }}
          >
            <Pressable onPress={() => setCustomOpen((v) => !v)} className="p-4">
              <View className="flex-row items-start">
                <View
                  className="mr-3 h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: month.strategyId === 'custom' ? TEAL : '#F3F4F6' }}
                >
                  <SlidersHorizontal size={20} color={month.strategyId === 'custom' ? '#fff' : TEAL} />
                </View>
                <View className="flex-1">
                  <View className="mb-0.5 flex-row items-center">
                    <Text className="mr-2 text-base font-extrabold text-neutral-900">Custom Strategy</Text>
                    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(2,100,98,0.1)' }}>
                      <Text className="text-[10px] font-bold" style={{ color: TEAL }}>
                        Yours
                      </Text>
                    </View>
                  </View>
                  <Text className="text-[12px] font-medium text-neutral-500">
                    Define your own allocation ratios for Needs, Wants, and Savings.
                  </Text>
                </View>
              </View>
            </Pressable>
            {customOpen ? (
              <View className="border-t border-neutral-200 px-4 pb-4 pt-3">
                {(['needs', 'wants', 'savings'] as const).map((key) => (
                  <View key={key} className="mb-2 flex-row items-center justify-between">
                    <Text className="text-xs font-bold capitalize text-neutral-800">{key}</Text>
                    <View className="flex-row items-center">
                      <TextInput
                        keyboardType="numeric"
                        value={String(split[key])}
                        onChangeText={(v) => {
                          const n = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
                          setSplit((prev) => ({ ...prev, [key]: n }));
                          setPreviewId('custom');
                        }}
                        className="mr-1 w-16 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-right text-[13px] font-bold"
                      />
                      <Text className="text-xs font-bold text-neutral-500">%</Text>
                    </View>
                  </View>
                ))}
                <Pressable
                  disabled={saving || split.needs + split.wants + split.savings !== 100}
                  onPress={() => apply('custom', draftCustom)}
                  className="mt-2 items-center rounded-xl py-3"
                  style={{
                    backgroundColor: TEAL,
                    opacity: split.needs + split.wants + split.savings === 100 ? 1 : 0.4,
                  }}
                >
                  <Text className="font-bold text-white">Apply custom split</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Sheet>
  );
}
