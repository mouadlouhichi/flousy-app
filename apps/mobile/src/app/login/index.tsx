import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMobileAuth } from '../../lib/auth-context';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle, enableDemoMode } = useMobileAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error', 'Error'), t('auth.invalidCredentials'));
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      router.replace('/dashboard');
    } catch (err: any) {
      Alert.alert(
        t('common.error', 'Error'),
        err?.message || t('auth.invalidCredentials')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/dashboard');
    } catch (err: any) {
      Alert.alert(
        t('common.error', 'Error'),
        err?.message || t('auth.googleSignInFailed')
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDemoMode = () => {
    enableDemoMode();
    router.replace('/dashboard');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-neutral-900"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="px-6 py-12"
      >
        <View className="items-center mb-8">
          <View className="w-16 h-16 bg-primary rounded-2xl items-center justify-center mb-4">
            <Text className="text-3xl font-bold text-white">F</Text>
          </View>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
            Flousy
          </Text>
          <Text className="text-neutral-500 dark:text-neutral-400 text-center mt-1">
            {t('auth.welcomeBack')}
          </Text>
        </View>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {t('auth.email')}
            </Text>
            <TextInput
              className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {t('auth.password')}
            </Text>
            <TextInput
              className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700"
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Pressable
            onPress={() => router.push('/reset-password')}
            className="self-end"
          >
            <Text className="text-sm text-primary font-medium">
              {t('auth.forgotPassword')}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleEmailSignIn}
            disabled={loading}
            className="w-full bg-primary py-3.5 rounded-xl items-center justify-center shadow-sm"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {t('auth.signIn')}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full bg-neutral-100 dark:bg-neutral-800 py-3.5 rounded-xl items-center justify-center border border-neutral-200 dark:border-neutral-700"
          >
            {googleLoading ? (
              <ActivityIndicator color="#2ea44f" />
            ) : (
              <Text className="text-neutral-800 dark:text-neutral-200 font-medium text-base">
                {t('auth.continueWithGoogle')}
              </Text>
            )}
          </Pressable>
        </View>

        <View className="my-6 border-t border-neutral-200 dark:border-neutral-800 pt-6">
          <View className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 items-center">
            <Text className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              {t('auth.demoMode')}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400 text-center mb-3">
              {t('auth.demoModeDescription')}
            </Text>
            <Pressable
              onPress={handleDemoMode}
              className="w-full bg-neutral-900 dark:bg-white py-3 rounded-xl items-center"
            >
              <Text className="text-white dark:text-neutral-900 font-semibold text-sm">
                {t('auth.continueDemo', 'Continue in Demo Mode')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row justify-center mt-4">
          <Text className="text-neutral-500 dark:text-neutral-400 text-sm">
            {t('auth.noAccount')}
          </Text>
          <Pressable onPress={() => router.push('/signup')} className="ml-1.5">
            <Text className="text-primary font-semibold text-sm">
              {t('auth.signUp')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
