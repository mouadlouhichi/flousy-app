import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMobileAuth } from '../lib/auth-context';
import { useMobileStore } from '../lib/store-context';
import { AppLogo } from './AppLogo';

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

export function DashboardHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, demoMode } = useMobileAuth();
  const { currentMonthKey, switchMonth, profile } = useMobileStore();
  const initial = (profile?.displayName || user?.email || 'S')[0]?.toUpperCase() || 'S';
  const onProfile = pathname?.includes('/settings') || pathname?.includes('/profile');

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
    <View className="flex-row items-center justify-between border-b border-neutral-200/80 bg-white/90 px-4 py-3">
      <View className="flex-row items-center gap-2 w-28">
        <AppLogo size={26} />
        <Text className="text-base font-extrabold tracking-tight" style={{ color: '#026462' }}>
          SmartJib
        </Text>
      </View>

      <View className="flex-row items-center rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-1">
        <Pressable onPress={prev} className="p-1" accessibilityLabel="Previous month">
          <ChevronLeft size={18} color="#374151" />
        </Pressable>
        <Text className="min-w-[48px] text-center text-xs font-bold uppercase text-neutral-900">
          {monthLabel(currentMonthKey)}
        </Text>
        <Pressable onPress={next} className="p-1" accessibilityLabel="Next month">
          <ChevronRight size={18} color="#374151" />
        </Pressable>
      </View>

      <View className="w-28 flex-row items-center justify-end gap-2">
        {demoMode ? (
          <View className="rounded-full bg-amber-100 px-2 py-0.5">
            <Text className="text-[10px] font-bold text-amber-800">Demo</Text>
          </View>
        ) : null}
        <Pressable
          onPress={() => router.push('/dashboard/settings')}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: onProfile ? '#026462' : 'rgba(2,100,98,0.12)' }}
          accessibilityLabel="Open profile"
        >
          <Text className="text-sm font-bold" style={{ color: onProfile ? '#fff' : '#026462' }}>
            {initial}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
