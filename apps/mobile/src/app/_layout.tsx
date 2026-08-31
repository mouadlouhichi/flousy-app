import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { MobileAuthProvider } from '../lib/auth-context';
import { configureGoogleSignIn } from '../lib/firebase';
import { FONT, useAppFonts } from '../lib/fonts';
import '../lib/i18n';
import '../global.css';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

try {
  configureGoogleSignIn();
} catch {
  // Google Sign-In will retry configure on tap
}

const textDefaults = { fontFamily: FONT.regular };
const RNText = Text as typeof Text & { defaultProps?: { style?: unknown } };
const RNInput = TextInput as typeof TextInput & { defaultProps?: { style?: unknown } };
RNText.defaultProps = { ...(RNText.defaultProps || {}), style: [textDefaults, RNText.defaultProps?.style] };
RNInput.defaultProps = { ...(RNInput.defaultProps || {}), style: [textDefaults, RNInput.defaultProps?.style] };

export default function RootLayout() {
  const [loaded, fontError] = useAppFonts();

  useEffect(() => {
    if (loaded || fontError) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, fontError]);

  if (!loaded && !fontError) return null;

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
