'use client';

import { useMemo } from 'react';
import { useAuth } from './auth-context';
import { useLanguage } from './i18n-context';
import { useOptionalHousehold } from './household-context';
import { localizePlaceName } from './localized-labels';
import {
  MoneyPlaceConfig,
  MonthBudget,
  getPlaceBalance,
  moneyPlaceIcon,
  resolveMoneyPlaces,
} from './store';
import type { SegmentedOption } from '@/components/ui/segmented-control';

type PlaceMonth = Pick<MonthBudget, 'bankPart' | 'homePart' | 'walletPart'> & {
  placeBalances?: Record<string, number>;
};

export function moneyPlaceSegmentOptions(
  places: MoneyPlaceConfig[],
  localize: (id: string, name: string) => string = (_id, name) => name,
): SegmentedOption[] {
  return places.map((p) => ({ value: p.id, label: localize(p.id, p.name), icon: p.icon }));
}

/** Current cash locations from the signed-in profile (defaults to Bank / Home / Wallet). */
export function useMoneyPlaces(month?: PlaceMonth | null) {
  const { profile } = useAuth();
  const householdContext = useOptionalHousehold();
  const { messages } = useLanguage();
  const places = useMemo(
    () => resolveMoneyPlaces(
      householdContext?.workspace === 'household'
        ? { moneyPlaces: householdContext.household?.moneyPlaces }
        : profile,
    ),
    [householdContext?.workspace, householdContext?.household?.moneyPlaces, profile],
  );
  const localizedLabel = (id: string, fallbackName: string) => localizePlaceName(id, fallbackName, messages);
  const options = useMemo(
    () => moneyPlaceSegmentOptions(places, localizedLabel),
    // `localizedLabel` is a per-render closure over `messages`; depending on it
    // would rebuild the options on every render for the same labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, messages],
  );
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
    label: (id: string) => {
      const place = places.find((candidate) => candidate.id === id);
      return place ? localizedLabel(place.id, place.name) : id;
    },
    icon: (id: string) => moneyPlaceIcon(id, places),
  };
}
