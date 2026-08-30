import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  type MoneyPlace,
  type MoneyPlaceConfig,
  type MonthBudget,
  DEFAULT_MONEY_PLACES,
  getPlaceBalance,
} from '@flousy/core';

export function MoneyPlaceChips({
  month,
  selected,
  onSelect,
  currency,
  places,
}: {
  month: MonthBudget;
  selected: MoneyPlace;
  onSelect: (place: MoneyPlace) => void;
  currency: string;
  places?: MoneyPlaceConfig[];
}) {
  const list = places && places.length > 0 ? places : DEFAULT_MONEY_PLACES;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2">
        {list.map((p) => {
          const active = selected === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelect(p.id)}
              className={`px-3 py-2.5 rounded-xl border items-center min-w-[88px] ${
                active
                  ? 'bg-primary/10 border-primary'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              <Text
                className={`font-semibold text-xs ${
                  active ? 'text-primary' : 'text-neutral-800 dark:text-neutral-200'
                }`}
              >
                {p.name}
              </Text>
              <Text className="text-xs text-neutral-500 mt-0.5">
                {getPlaceBalance(month, p.id)} {currency}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
