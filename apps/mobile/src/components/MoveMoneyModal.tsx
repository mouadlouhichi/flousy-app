import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Landmark, Home, Wallet, ArrowUpDown, X } from 'lucide-react-native';
import {
  type MoneyPlace,
  type MoneyPlaceConfig,
  type MonthBudget,
  getPlaceBalance,
} from '@flousy/core';
import { Sheet } from './Sheet';
import { formatMoney } from '../lib/format-money';

const TEAL = '#026462';

const ICONS: Record<string, typeof Landmark> = {
  bank: Landmark,
  home: Home,
  wallet: Wallet,
};

interface MoveMoneyModalProps {
  visible: boolean;
  onClose: () => void;
  month: MonthBudget;
  currency: string;
  places?: MoneyPlaceConfig[];
  initialFrom?: MoneyPlace;
  onConfirm: (from: MoneyPlace, to: MoneyPlace, amount: number) => Promise<void>;
}

export function MoveMoneyModal({
  visible,
  onClose,
  month,
  currency,
  places: placeConfigs,
  initialFrom,
  onConfirm,
}: MoveMoneyModalProps) {
  const places = (
    placeConfigs && placeConfigs.length > 0
      ? placeConfigs
      : [
          { id: 'bank', name: 'Bank', icon: 'account_balance' },
          { id: 'home', name: 'Home', icon: 'home' },
          { id: 'wallet', name: 'Wallet', icon: 'account_balance_wallet' },
        ]
  ).map((p) => ({
    id: p.id as MoneyPlace,
    label: p.name,
    balance: getPlaceBalance(month, p.id),
  }));

  const fallbackTo = (from: string) => places.find((p) => p.id !== from)?.id || from;

  const [fromPlace, setFromPlace] = useState<MoneyPlace>(initialFrom || places[0]?.id || 'bank');
  const [toPlace, setToPlace] = useState<MoneyPlace>(fallbackTo(initialFrom || places[0]?.id || 'bank'));
  const [amountStr, setAmountStr] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const from = initialFrom && places.some((p) => p.id === initialFrom) ? initialFrom : places[0]?.id || 'bank';
    setFromPlace(from);
    setToPlace(fallbackTo(from));
    setAmountStr('');
    setError('');
  }, [visible, initialFrom]);

  const parsed = parseFloat(amountStr) || 0;
  const fromBal = getPlaceBalance(month, fromPlace);
  const toBal = getPlaceBalance(month, toPlace);
  const actual = Math.min(fromBal, Math.max(0, parsed));

  const handleTransfer = async () => {
    if (!(parsed > 0)) {
      setError('Enter an amount to transfer.');
      return;
    }
    if (fromPlace === toPlace) {
      setError('Source and destination cannot be the same.');
      return;
    }
    if (parsed > fromBal) {
      setError(`Not enough in ${places.find((p) => p.id === fromPlace)?.label || fromPlace}.`);
      return;
    }
    setLoading(true);
    try {
      await onConfirm(fromPlace, toPlace, parsed);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to move money');
    } finally {
      setLoading(false);
    }
  };

  const PlaceRow = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: MoneyPlace;
    onChange: (id: MoneyPlace) => void;
  }) => (
    <View className="mb-3">
      <Text className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">{label}</Text>
      <View className="flex-row flex-wrap rounded-2xl border border-neutral-200 bg-[#F5FAF8] p-1">
        {places.map((p) => {
          const selected = value === p.id;
          const Icon = ICONS[p.id] || Wallet;
          return (
            <Pressable
              key={p.id}
              onPress={() => onChange(p.id)}
              className="min-w-[30%] flex-1 items-center rounded-xl px-2 py-2.5"
              style={{ backgroundColor: selected ? TEAL : 'transparent' }}
              hitSlop={6}
            >
              <Icon size={18} color={selected ? '#fff' : '#6B7280'} />
              <Text
                className="mt-1 text-[12px] font-bold"
                style={{ color: selected ? '#fff' : '#374151' }}
                numberOfLines={1}
              >
                {p.label}
              </Text>
              <Text className="text-[10px]" style={{ color: selected ? 'rgba(255,255,255,0.8)' : '#9CA3AF' }}>
                {formatMoney(p.balance)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose}>
        <View className="max-h-[92%] rounded-t-[28px] bg-[#F5FAF8] px-5 pb-8 pt-3">
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-neutral-300" />
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-extrabold text-neutral-900">Move Money</Text>
            <Pressable onPress={onClose} hitSlop={12} className="p-1">
              <X size={22} color="#374151" />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4">
              <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
                Transfer between accounts
              </Text>
              <PlaceRow
                label="From"
                value={fromPlace}
                onChange={(id) => {
                  setFromPlace(id);
                  if (id === toPlace) setToPlace(fallbackTo(id));
                  setError('');
                }}
              />
              <PlaceRow
                label="To"
                value={toPlace}
                onChange={(id) => {
                  setToPlace(id);
                  if (id === fromPlace) setFromPlace(fallbackTo(id));
                  setError('');
                }}
              />
            </View>

            <View className="mb-4 items-center py-1">
              <Text className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
                Transfer amount
              </Text>
              <View className="flex-row items-end">
                <Text className="mb-1 mr-1 text-lg font-bold" style={{ color: TEAL }}>
                  {currency}
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={amountStr}
                  onChangeText={(v) => {
                    setAmountStr(v.replace(/[^0-9.]/g, ''));
                    setError('');
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#D1D5DB"
                  className="min-w-[140px] text-center text-[40px] font-extrabold text-neutral-900"
                />
              </View>
              {error ? <Text className="mt-1 text-center text-xs font-medium text-red-600">{error}</Text> : null}
              <View className="mt-3 flex-row flex-wrap justify-center">
                {[100, 200, 500, 1000].map((chip) => (
                  <Pressable
                    key={chip}
                    onPress={() => {
                      setAmountStr(String(parsed + chip));
                      setError('');
                    }}
                    className="m-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5"
                  >
                    <Text className="text-[12px] font-bold text-neutral-600">
                      +{currency} {formatMoney(chip)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
          <View className="mb-3 mt-2 rounded-2xl border border-primary/20 bg-primary/5 p-3.5">
            <Text className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: TEAL }}>
              Preview after transfer
            </Text>
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-[13px] text-neutral-500">
                {places.find((p) => p.id === fromPlace)?.label}:
              </Text>
              <Text className="text-[13px] font-semibold text-neutral-800">
                {currency} {formatMoney(fromBal)} →{' '}
                <Text className="text-amber-800">
                  {currency} {formatMoney(fromBal - actual)}
                </Text>
              </Text>
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-[13px] text-neutral-500">
                {places.find((p) => p.id === toPlace)?.label}:
              </Text>
              <Text className="text-[13px] font-semibold text-neutral-800">
                {currency} {formatMoney(toBal)} →{' '}
                <Text style={{ color: TEAL }}>
                  {currency} {formatMoney(toBal + actual)}
                </Text>
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleTransfer}
            disabled={loading}
            className="mt-1 flex-row items-center justify-center rounded-xl py-3.5"
            style={{ backgroundColor: TEAL, opacity: loading ? 0.6 : 1 }}
          >
            <ArrowUpDown size={18} color="#fff" />
            <Text className="ml-2 text-[15px] font-bold text-white">
              {loading ? 'Moving…' : 'Confirm Transfer'}
            </Text>
          </Pressable>
        </View>
    </Sheet>
  );
}
