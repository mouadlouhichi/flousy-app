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

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sendPasswordReset } = useMobileAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert(
        t('common.error', 'Error'),
        t('auth.enterEmailToReset', 'Please enter your email address to reset password.')
      );
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      Alert.alert(
        t('common.success', 'Success'),
        t('auth.passwordResetSent', 'Password reset email sent!')
      );
      router.back();
    } catch (err: any) {
      Alert.alert(
        t('common.error', 'Error'),
        err?.message || t('auth.failedResetEmail', 'Failed to send reset email')
      );
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
            {t('auth.resetPassword')}
          </Text>
          <Text className="text-neutral-500 dark:text-neutral-400 text-center mt-2">
            {t('auth.enterEmailToReset')}
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

          <Pressable
            onPress={handleReset}
            disabled={loading}
            className="w-full bg-primary py-3.5 rounded-xl items-center justify-center shadow-sm mt-2"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {t('auth.sendResetLink', 'Send Reset Link')}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()} className="items-center py-2">
            <Text className="text-neutral-500 dark:text-neutral-400 font-medium text-sm">
              {t('auth.backToLogin')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
