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

export default function SignupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signUpWithEmail, sendEmailVerification, signInWithGoogle } = useMobileAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || password.length < 6) {
      Alert.alert(
        t('common.error', 'Error'),
        t('auth.passwordPlaceholder', 'Password must be at least 6 characters')
      );
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password);
      await sendEmailVerification();
      Alert.alert(
        t('common.success', 'Success'),
        t('auth.verificationSent', 'Verification email sent!')
      );
      router.replace('/onboarding');
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
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
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
            {t('auth.createYourAccount')}
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
            onPress={handleSignUp}
            disabled={loading}
            className="w-full bg-primary py-3.5 rounded-xl items-center justify-center shadow-sm mt-2"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {t('auth.signUp')}
              </Text>
            )}
          </Pressable>
        </View>

        <View className="flex-row justify-center mt-6">
          <Text className="text-neutral-500 dark:text-neutral-400 text-sm">
            {t('auth.hasAccount')}
          </Text>
          <Pressable onPress={() => router.replace('/login')} className="ml-1.5">
            <Text className="text-primary font-semibold text-sm">
              {t('auth.signIn')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
