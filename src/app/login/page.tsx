'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { loginSchema } from '../../lib/validation';
import { authErrorMessage } from '../../lib/auth-errors';
import { getCurrentMonthKey } from '../../lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading, signInEmail, signUpEmail, signInGoogle, sendResetEmail, isConfigured } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (loading) return;

    const isDemo =
      typeof window !== 'undefined' &&
      localStorage.getItem('flousy_demo_mode') === 'true';

    const today = new Date();
    const monthKey = getCurrentMonthKey(profile?.monthStartDate, today);
    const onboardingDoneLocally =
      typeof window !== 'undefined' &&
      (localStorage.getItem('flousy_onboarding_done') === 'true' ||
        !!localStorage.getItem(`flousy_month_${monthKey}`));

    // Onboarding is always the first screen after signup (or whenever the
    // profile still has onboardingComplete === false).
    const needsOnboarding =
      !!profile && profile.onboardingComplete === false && !onboardingDoneLocally;

    let destination: string | null = null;
    if (user) {
      destination = needsOnboarding ? '/onboarding' : '/dashboard';
    } else if (isDemo) {
      destination = onboardingDoneLocally ? '/dashboard' : '/onboarding';
    }

    if (destination) {
      try {
        router.replace(destination);
      } catch {
        window.location.href = destination;
      }
    }
  }, [user, profile, loading, router]);

  const isDemoMode = typeof window !== 'undefined' && localStorage.getItem('flousy_demo_mode') === 'true';

  if (loading || user || isDemoMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const navigateTo = (path: string) => {
    try {
      router.push(path);
    } catch {
      window.location.href = path;
    }
  };

  const handleDemoAccess = () => {
    localStorage.setItem('flousy_demo_mode', 'true');
    navigateTo('/onboarding');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (isResetting) {
      if (!email) {
        setError('Please enter your email address to reset password.');
        return;
      }
      try {
        setSubmitting(true);
        if (isConfigured) {
          await sendResetEmail(email);
          setMessage('Password reset email sent! Please check your inbox.');
        } else {
          setMessage('Demo Mode: Password reset requested for ' + email);
        }
        setIsResetting(false);
      } catch (err: any) {
        setError(authErrorMessage(err) || 'Failed to send reset email');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const valRes = loginSchema.safeParse({ email, password });
    if (!valRes.success) {
      const firstErr =
        valRes.error.issues?.[0]?.message ||
        (valRes.error as any).errors?.[0]?.message ||
        'Invalid email or password';
      setError(firstErr);
      return;
    }

    try {
      setSubmitting(true);
      if (!isConfigured) {
        // Fallback for demo mode
        localStorage.setItem('flousy_demo_email', email);
        localStorage.setItem('flousy_demo_mode', 'true');
        navigateTo('/dashboard');
        return;
      }

      if (isSignUp) {
        await signUpEmail(email, password, displayName.trim() || undefined);
        navigateTo('/onboarding');
      } else {
        const syncedProfile = await signInEmail(email, password);
        // Onboarding is always the first screen when it hasn't been completed
        const localDone = localStorage.getItem('flousy_onboarding_done') === 'true';
        navigateTo(
          syncedProfile && syncedProfile.onboardingComplete === false && !localDone
            ? '/onboarding'
            : '/dashboard',
        );
      }
    } catch (err: any) {
      // If authentication failed because Firebase isn't configured, fallback gracefully to Demo Mode
      if (!isConfigured || err.message?.includes('not configured')) {
        localStorage.setItem('flousy_demo_email', email);
        localStorage.setItem('flousy_demo_mode', 'true');
        navigateTo('/dashboard');
      } else {
        setError(authErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      setSubmitting(true);
      if (!isConfigured) {
        localStorage.setItem('flousy_demo_mode', 'true');
        navigateTo('/dashboard');
        return;
      }
      const isNewUser = await signInGoogle();
      navigateTo(isNewUser ? '/onboarding' : '/dashboard');
    } catch (err: any) {
      if (!isConfigured || err.message?.includes('not configured')) {
        localStorage.setItem('flousy_demo_mode', 'true');
        navigateTo('/dashboard');
      } else {
        setError(err.message || 'Google sign-in failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-8 font-sans">
      <div className="w-full max-w-[420px] bg-surface p-6 sm:p-8 rounded-[28px] border border-outline-variant/50 shadow-md flex flex-col gap-5">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center gap-1">
          <a href="/" className="flex flex-col items-center gap-1.5 group">
            <Image
              src="/logo.png"
              alt="SmartJib logo"
              width={64}
              height={64}
              className="object-contain"
              priority
            />
            <span className="font-display text-[32px] font-extrabold text-primary tracking-tight">
              SmartJib
            </span>
          </a>
          <p className="text-[15px] font-medium text-on-surface-variant mt-0.5">
            {isResetting
              ? 'Reset Your Password'
              : isSignUp
              ? 'Create your account'
              : 'Welcome back to your financial center'}
          </p>
        </div>

        {/* Demo Mode Banner if Firebase is not connected */}
        {!isConfigured && (
          <div className="p-4 bg-primary-container border border-primary/20 rounded-2xl flex flex-col gap-2.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-primary font-bold text-[14px]">
              <AppIcon name="info" className=" text-[18px]" />
              <span>Demo Mode Available</span>
            </div>
            <p className="text-[13px] text-on-surface-variant leading-snug">
              Experience SmartJib instantly with sample data in local preview mode.
            </p>
            <button
              type="button"
              onClick={handleDemoAccess}
              className="w-full py-2.5 bg-primary hover:bg-primary text-white text-[14px] font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              Continue in Demo Mode
            </button>
          </div>
        )}

        {/* Success Message Banner */}
        {message && (
          <div className="p-3.5 bg-primary-container border border-primary/30 rounded-xl text-[14px] text-primary font-medium">
            {message}
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-3.5 bg-error-container/20 border border-error/40 rounded-xl text-[14px] text-error font-medium">
            {error}
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Display Name (Sign Up Only) */}
          {isSignUp && !isResetting && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-on-surface-variant">Full Name</label>
              <div className="relative flex items-center">
                <AppIcon name="person" className=" absolute left-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-background border border-outline-variant rounded-xl text-base text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:bg-surface transition-all outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant">Email</label>
            <div className="relative flex items-center">
              <AppIcon name="mail" className=" absolute left-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-background border border-outline-variant rounded-xl text-base text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:bg-surface transition-all outline-none"
              />
            </div>
          </div>

          {!isResetting && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[13px] font-bold text-on-surface-variant">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => setIsResetting(true)}
                    className="text-[13px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <AppIcon name="lock" className=" absolute left-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required={!isResetting}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-outline-variant rounded-xl text-base text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:bg-surface transition-all outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary active:scale-[0.99] text-white font-bold text-[16px] py-3.5 rounded-xl transition-all shadow-xs mt-1 disabled:opacity-50 cursor-pointer"
          >
            {submitting
              ? 'Processing...'
              : isResetting
              ? 'Send Reset Link'
              : isSignUp
              ? 'Create account'
              : 'Log in'}
          </button>
        </form>

        {!isResetting && (
          <>
            {/* OR Divider */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-surface-variant" />
              <span className="text-[12px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
                OR
              </span>
              <div className="flex-1 h-px bg-surface-variant" />
            </div>

            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-surface hover:bg-surface-container-low text-on-surface-variant border border-outline-variant rounded-xl font-bold text-[15px] flex items-center justify-center gap-3 transition-all shadow-2xs cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </>
        )}

        {/* Toggle Sign Up vs Sign In */}
        <div className="flex justify-center items-center gap-1.5 text-[14px] text-on-surface-variant pt-2 border-t border-outline-variant/50">
          {isResetting ? (
            <button
              onClick={() => setIsResetting(false)}
              className="text-primary font-bold hover:underline cursor-pointer"
            >
              Back to log in
            </button>
          ) : isSignUp ? (
            <>
              <span>Already have an account?</span>
              <button
                onClick={() => setIsSignUp(false)}
                className="text-primary font-bold hover:underline cursor-pointer"
              >
                Log in
              </button>
            </>
          ) : (
            <>
              <span>Don't have an account?</span>
              <button
                onClick={() => setIsSignUp(true)}
                className="text-primary font-bold hover:underline cursor-pointer"
              >
                Create account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
