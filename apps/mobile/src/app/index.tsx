import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useMobileAuth } from '../lib/auth-context';

export default function IndexScreen() {
  const { user, authLoading, demoMode } = useMobileAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (user || demoMode) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [user, authLoading, demoMode, router]);

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
      <ActivityIndicator size="large" color="#2ea44f" />
    </View>
  );
}
