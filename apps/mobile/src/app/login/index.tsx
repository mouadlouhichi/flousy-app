import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, User } from 'lucide-react-native';
import { useMobileAuth } from '../../lib/auth-context';
import { AppLogo } from '../../components/AppLogo';
import { GoogleMark } from '../../components/GoogleMark';
import { authErrorMessage } from '@flousy/core';

const TEAL = '#026462';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    sendPasswordReset,
    enableDemoMode,
    sendEmailVerification,
  } = useMobileAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const goDashboard = () => router.replace('/dashboard');
  const goOnboarding = () => router.replace('/onboarding');

  const handleSubmit = async () => {
    setError('');
    setMessage('');
    if (isResetting) {
      if (!email.trim()) {
        setError('Please enter your email address to reset password.');
        return;
      }
      setSubmitting(true);
      try {
        await sendPasswordReset(email.trim());
        setMessage('Password reset email sent! Please check your inbox.');
        setIsResetting(false);
      } catch (err: any) {
        setError(authErrorMessage(err) || err?.message || 'Failed to send reset email');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError(t('auth.invalidCredentials'));
      return;
    }
    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email.trim(), password);
        try {
          await sendEmailVerification();
        } catch {
          // verification is best-effort
        }
        goOnboarding();
      } else {
        await signInWithEmail(email.trim(), password);
        goDashboard();
      }
    } catch (err: any) {
      setError(authErrorMessage(err) || err?.message || t('auth.invalidCredentials'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSubmitting(true);
    try {
      const ok = await signInWithGoogle();
      if (ok) goDashboard();
    } catch (err: any) {
      if (err?.code === 'SIGN_IN_CANCELLED' || err?.code === '12501') return;
      setError(err?.message || t('auth.googleSignInFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const subtitle = isResetting
    ? 'Reset Your Password'
    : isSignUp
      ? t('auth.createYourAccount', 'Create your account')
      : 'Welcome back to your financial center';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      style={{ backgroundColor: '#F5FAF8' }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="w-full self-center rounded-[28px] border border-neutral-200 bg-white p-6"
          style={{
            maxWidth: 420,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}
        >
          <View className="items-center mb-5">
            <AppLogo size={64} style={{ marginBottom: 8 }} />
            <Text className="text-[32px] font-extrabold tracking-tight" style={{ color: TEAL }}>
              SmartJib
            </Text>
            <Text className="mt-1 text-center text-[15px] font-medium text-neutral-500">{subtitle}</Text>
          </View>

          {message ? (
            <View className="mb-3 rounded-xl border px-3.5 py-3" style={{ backgroundColor: 'rgba(2,100,98,0.08)', borderColor: 'rgba(2,100,98,0.3)' }}>
              <Text className="text-sm font-medium" style={{ color: TEAL }}>{message}</Text>
            </View>
          ) : null}
          {error ? (
            <View className="mb-3 rounded-xl border border-red-300 bg-red-50 px-3.5 py-3">
              <Text className="text-sm font-medium text-red-700">{error}</Text>
            </View>
          ) : null}

          {isSignUp && !isResetting ? (
            <View className="mb-3">
              <Text className="mb-1.5 text-[13px] font-bold text-neutral-500">Full Name</Text>
              <View className="flex-row items-center rounded-xl border border-neutral-200 bg-[#F5FAF8] px-3">
                <User size={18} color="#9CA3AF" />
                <TextInput
                  className="flex-1 px-3 py-3 text-base text-neutral-900"
                  placeholder="Your full name"
                  placeholderTextColor="#9CA3AF"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              </View>
            </View>
          ) : null}

          <View className="mb-3">
            <Text className="mb-1.5 text-[13px] font-bold text-neutral-500">{t('auth.email')}</Text>
            <View className="flex-row items-center rounded-xl border border-neutral-200 bg-[#F5FAF8] px-3">
              <Mail size={18} color="#9CA3AF" />
              <TextInput
                className="flex-1 px-3 py-3 text-base text-neutral-900"
                placeholder="name@example.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {!isResetting ? (
            <View className="mb-3">
              <View className="mb-1.5 flex-row items-center justify-between">
                <Text className="text-[13px] font-bold text-neutral-500">{t('auth.password')}</Text>
                {!isSignUp ? (
                  <Pressable onPress={() => setIsResetting(true)}>
                    <Text className="text-[13px] font-bold" style={{ color: TEAL }}>
                      {t('auth.forgotPassword')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View className="flex-row items-center rounded-xl border border-neutral-200 bg-[#F5FAF8] px-3">
                <Lock size={18} color="#9CA3AF" />
                <TextInput
                  className="flex-1 px-3 py-3 text-base text-neutral-900"
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            className="mt-1 items-center justify-center rounded-xl py-3.5"
            style={{ backgroundColor: TEAL, opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">
                {isResetting ? 'Send Reset Link' : isSignUp ? t('auth.signUp') : t('auth.signIn')}
              </Text>
            )}
          </Pressable>

          {!isResetting ? (
            <>
              <View className="my-4 flex-row items-center gap-3">
                <View className="h-px flex-1 bg-neutral-200" />
                <Text className="text-[12px] font-bold uppercase tracking-wider text-neutral-400">OR</Text>
                <View className="h-px flex-1 bg-neutral-200" />
              </View>

              <Pressable
                onPress={handleGoogleSignIn}
                disabled={submitting}
                className="flex-row items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white py-3.5"
              >
                <GoogleMark size={20} />
                <Text className="text-[15px] font-bold text-neutral-700">
                  {t('auth.continueWithGoogle')}
                </Text>
              </Pressable>
            </>
          ) : null}

          <View className="mt-5 flex-row items-center justify-center border-t border-neutral-200 pt-4">
            {isResetting ? (
              <Pressable onPress={() => setIsResetting(false)}>
                <Text className="text-sm font-bold" style={{ color: TEAL }}>Back to log in</Text>
              </Pressable>
            ) : isSignUp ? (
              <>
                <Text className="text-sm text-neutral-500">{t('auth.hasAccount')} </Text>
                <Pressable onPress={() => setIsSignUp(false)}>
                  <Text className="text-sm font-bold" style={{ color: TEAL }}>{t('auth.signIn')}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text className="text-sm text-neutral-500">{t('auth.noAccount')} </Text>
                <Pressable onPress={() => setIsSignUp(true)}>
                  <Text className="text-sm font-bold" style={{ color: TEAL }}>{t('auth.signUp')}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        <Pressable
          onPress={() => {
            enableDemoMode();
            goDashboard();
          }}
          className="mt-5 items-center"
        >
          <Text className="text-sm font-semibold text-neutral-500">
            {t('auth.continueDemo', 'Continue in Demo Mode')}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
