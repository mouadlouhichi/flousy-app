import React, { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DashboardScrollView as ScrollView } from './DashboardScrollView';

const TEAL = '#00685f';

export function ProfileSubpage({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <View className="flex-1 bg-[#F5FAF8]">
      <Pressable onPress={() => router.push('/dashboard/settings')} className="px-4 pt-1 pb-1" hitSlop={8}>
        <Text className="text-sm font-bold" style={{ color: TEAL }}>
          ← Profile
        </Text>
      </Pressable>
      <Text className="px-4 pb-2 text-xl font-extrabold text-neutral-900">{title}</Text>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>{children}</ScrollView>
    </View>
  );
}
