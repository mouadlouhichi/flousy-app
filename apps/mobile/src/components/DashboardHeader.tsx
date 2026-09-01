import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Bell, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMobileAuth } from '../lib/auth-context';
import { useMobileStore } from '../lib/store-context';
import { AppLogo } from './AppLogo';

const TEAL = '#026462';

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

export function DashboardHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, demoMode } = useMobileAuth();
  const { currentMonthKey, switchMonth, profile } = useMobileStore();
  const initial = (profile?.displayName || user?.displayName || user?.email || 'S')[0]?.toUpperCase() || 'S';
  const onProfile = pathname?.includes('/settings') || pathname?.includes('/profile');
  const cycleDay = profile?.monthStartDate || 1;

  const prev = () => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    switchMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const next = () => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    const d = new Date(y, m, 1);
    switchMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <View className="flex-row items-center justify-between bg-[#F5FAF8] px-4 py-3">
      <View className="w-[108px] flex-row items-center gap-1.5">
        <AppLogo size={22} />
        <Text className="text-base font-extrabold tracking-tight" style={{ color: TEAL }}>
          SmartJib
        </Text>
      </View>

      <View className="flex-row items-center rounded-full border border-neutral-200 bg-white px-1 py-1">
        <Pressable onPress={prev} className="px-1.5 py-1" accessibilityLabel="Previous month">
          <ChevronLeft size={16} color="#374151" />
        </Pressable>
        <Text className="px-1 text-xs font-extrabold tracking-wide text-neutral-800">
          {monthLabel(currentMonthKey)}
        </Text>
        <View className="mx-0.5 flex-row items-center rounded-full bg-[#E7F3F1] px-1.5 py-0.5">
          <CalendarDays size={12} color={TEAL} />
          <Text className="ml-0.5 text-[11px] font-bold" style={{ color: TEAL }}>
            {cycleDay}
          </Text>
        </View>
        <Pressable onPress={next} className="px-1.5 py-1" accessibilityLabel="Next month">
          <ChevronRight size={16} color="#374151" />
        </Pressable>
      </View>

      <View className="w-[108px] flex-row items-center justify-end gap-2">
        {demoMode ? (
          <View className="rounded-full bg-amber-100 px-1.5 py-0.5">
            <Text className="text-[9px] font-bold text-amber-800">Demo</Text>
          </View>
        ) : null}
        <Pressable onPress={() => router.push('/dashboard/settings')} className="p-1" accessibilityLabel="Notifications">
          <Bell size={20} color="#374151" />
        </Pressable>
        <Pressable
          onPress={() => router.push('/dashboard/settings')}
          className="h-8 w-8 items-center justify-center overflow-hidden rounded-full"
          style={{ backgroundColor: onProfile ? TEAL : 'rgba(2,100,98,0.15)' }}
          accessibilityLabel="Open profile"
        >
          <Text className="text-xs font-bold" style={{ color: onProfile ? '#fff' : TEAL }}>
            {initial}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
