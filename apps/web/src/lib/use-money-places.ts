'use client';

import { useMemo } from 'react';
import { useAuth } from './auth-context';
import {
  MoneyPlaceConfig,
  MonthBudget,
  getPlaceBalance,
  moneyPlaceIcon,
  moneyPlaceLabel,
  resolveMoneyPlaces,
} from './store';
import type { SegmentedOption } from '@/components/ui/segmented-control';

type PlaceMonth = Pick<MonthBudget, 'bankPart' | 'homePart' | 'walletPart'> & {
  placeBalances?: Record<string, number>;
};

export function moneyPlaceSegmentOptions(places: MoneyPlaceConfig[]): SegmentedOption[] {
  return places.map((p) => ({ value: p.id, label: p.name, icon: p.icon }));
}

/** Current cash locations from the signed-in profile (defaults to Bank / Home / Wallet). */
export function useMoneyPlaces(month?: PlaceMonth | null) {
  const { profile } = useAuth();
  const places = useMemo(() => resolveMoneyPlaces(profile), [profile]);
  const options = useMemo(() => moneyPlaceSegmentOptions(places), [places]);
  const defaultPlace = places[0]?.id || 'bank';
  const balances = useMemo(() => {
    const rec: Record<string, number> = {};
    if (!month) return rec;
    for (const p of places) rec[p.id] = getPlaceBalance(month, p.id);
    return rec;
  }, [places, month]);

  return {
    places,
    options,
    balances,
    defaultPlace,
    label: (id: string) => moneyPlaceLabel(id, places),
    icon: (id: string) => moneyPlaceIcon(id, places),
  };
}
