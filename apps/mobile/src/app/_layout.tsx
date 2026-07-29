import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MobileAuthProvider } from '../lib/auth-context';
import '../lib/i18n';
import '../global.css';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <MobileAuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login/index" />
          <Stack.Screen name="signup/index" />
          <Stack.Screen name="reset-password/index" />
          <Stack.Screen name="onboarding/index" />
          <Stack.Screen name="dashboard" />
        </Stack>
      </MobileAuthProvider>
    </SafeAreaProvider>
  );
}
