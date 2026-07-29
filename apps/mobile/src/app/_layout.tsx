import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MobileAuthProvider } from '../lib/auth-context';
import { configureGoogleSignIn } from '../lib/firebase';
import '../lib/i18n';
import '../global.css';

// Configure Google Sign-In with the Web Client ID from app config
// The webClientId is required for obtaining ID tokens from Google Sign-In on Android
try {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
  if (webClientId) {
    configureGoogleSignIn(webClientId);
  }
} catch {
  // Ignore — Google Sign-In will be unavailable until configured
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
