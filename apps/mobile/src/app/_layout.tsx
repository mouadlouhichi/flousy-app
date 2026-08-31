import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MobileAuthProvider } from '../lib/auth-context';
import { configureGoogleSignIn } from '../lib/firebase';
import '../lib/i18n';
import '../global.css';

try {
  configureGoogleSignIn();
} catch {
  // Google Sign-In will retry configure on tap
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}
