'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { loginSchema } from '../../lib/validation';

export default function LoginPage() {
  const router = useRouter();
  const { signInEmail, signUpEmail, signInGoogle, sendResetEmail, isConfigured } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
        setError(err.message || 'Failed to send reset email');
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
        await signInEmail(email, password);
        navigateTo('/dashboard');
      }
    } catch (err: any) {
      // If authentication failed because Firebase isn't configured, fallback gracefully to Demo Mode
      if (!isConfigured || err.message?.includes('not configured')) {
        localStorage.setItem('flousy_demo_email', email);
        localStorage.setItem('flousy_demo_mode', 'true');
        navigateTo('/dashboard');
      } else {
        setError(err.message || 'Authentication failed. Please verify credentials.');
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
      await signInGoogle();
      navigateTo('/dashboard');
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
    <div className="min-h-screen bg-[#f8faf9] flex flex-col justify-center items-center px-4 py-8 font-sans">
      <div className="w-full max-w-[420px] bg-white p-6 sm:p-8 rounded-[28px] border border-slate-100 shadow-md flex flex-col gap-5">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center gap-1">
          <a href="/" className="flex flex-col items-center gap-1 group">
            <span className="text-[32px] font-extrabold text-[#006A60] tracking-tight">
              Flousy
            </span>
          </a>
          <p className="text-[15px] font-medium text-slate-600 mt-0.5">
            {isResetting
              ? 'Reset Your Password'
              : isSignUp
              ? 'Create your account'
              : 'Welcome back to your financial center'}
          </p>
        </div>

        {/* Demo Mode Banner if Firebase is not connected */}
        {!isConfigured && (
          <div className="p-4 bg-[#e6f2f0] border border-[#006A60]/20 rounded-2xl flex flex-col gap-2.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[#006A60] font-bold text-[14px]">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span>Demo Mode Available</span>
            </div>
            <p className="text-[13px] text-slate-600 leading-snug">
              Experience Flousy instantly with sample data in local preview mode.
            </p>
            <button
              type="button"
              onClick={handleDemoAccess}
              className="w-full py-2.5 bg-[#006A60] hover:bg-[#00544c] text-white text-[14px] font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              Continue in Demo Mode
            </button>
          </div>
        )}

        {/* Success Message Banner */}
        {message && (
          <div className="p-3.5 bg-[#e6f2f0] border border-[#006A60]/30 rounded-xl text-[14px] text-[#006A60] font-medium">
            {message}
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-[14px] text-red-600 font-medium">
            {error}
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Display Name (Sign Up Only) */}
          {isSignUp && !isResetting && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-slate-700">Full Name</label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[20px] pointer-events-none">
                  person
                </span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-[#f8faf9] border border-slate-200 rounded-xl text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-[#006A60] focus:bg-white transition-all outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-slate-700">Email</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[20px] pointer-events-none">
                mail
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-[#f8faf9] border border-slate-200 rounded-xl text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-[#006A60] focus:bg-white transition-all outline-none"
              />
            </div>
          </div>

          {!isResetting && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[13px] font-bold text-slate-700">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => setIsResetting(true)}
                    className="text-[13px] font-bold text-[#006A60] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[20px] pointer-events-none">
                  lock
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required={!isResetting}
                  className="w-full pl-10 pr-4 py-3 bg-[#f8faf9] border border-slate-200 rounded-xl text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-[#006A60] focus:bg-white transition-all outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#006A60] hover:bg-[#00544c] active:scale-[0.99] text-white font-bold text-[16px] py-3.5 rounded-xl transition-all shadow-xs mt-1 disabled:opacity-50 cursor-pointer"
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
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">
                OR
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-[15px] flex items-center justify-center gap-3 transition-all shadow-2xs cursor-pointer"
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
        <div className="flex justify-center items-center gap-1.5 text-[14px] text-slate-600 pt-2 border-t border-slate-100">
          {isResetting ? (
            <button
              onClick={() => setIsResetting(false)}
              className="text-[#006A60] font-bold hover:underline cursor-pointer"
            >
              Back to log in
            </button>
          ) : isSignUp ? (
            <>
              <span>Already have an account?</span>
              <button
                onClick={() => setIsSignUp(false)}
                className="text-[#006A60] font-bold hover:underline cursor-pointer"
              >
                Log in
              </button>
            </>
          ) : (
            <>
              <span>Don't have an account?</span>
              <button
                onClick={() => setIsSignUp(true)}
                className="text-[#006A60] font-bold hover:underline cursor-pointer"
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
