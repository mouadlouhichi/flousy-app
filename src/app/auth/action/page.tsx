'use client';

/**
 * Branded handler for the auth links SmartJib emails from its own domain
 * (see src/app/api/auth/email/route.ts):
 *
 *   /auth/action?mode=verifyEmail&oobCode=…    → confirms the address
 *   /auth/action?mode=resetPassword&oobCode=… → new-password form
 *
 * The page deliberately mirrors the /login visual language (mint backdrop,
 * floating white card, wordmark) so the inbox → action → sign-in journey
 * reads as one continuous brand experience instead of Firebase's hosted
 * handler page.
 */
import { AppIcon } from '@/components/ui/app-icon';
import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  applyActionCode,
  confirmPasswordReset,
  onAuthStateChanged,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useLightLanguage } from '@/lib/i18n-light';
import { signUpPasswordSchema } from '@/lib/validation';

type PageState =
  | { status: 'checking' }
  | { status: 'reset_form'; email: string }
  | { status: 'submitting'; email: string }
  | { status: 'verified' }
  | { status: 'reset_done' }
  | { status: 'invalid' };

function AuthActionPage() {
  const { messages: m, t } = useLightLanguage();
  const searchParams = useSearchParams();
  const copy = m.authAction;
  const [state, setState] = useState<PageState>({ status: 'checking' });
  const [signedIn, setSignedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState('');
  const mode = searchParams.get('mode') || '';
  const oobCode = searchParams.get('oobCode') || '';

  // Track sign-in only to route the "continue" button correctly; the action
  // itself never requires a session.
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => setSignedIn(Boolean(u)));
  }, []);

  useEffect(() => {
    if (!auth || !oobCode || (mode !== 'verifyEmail' && mode !== 'resetPassword')) {
      setState({ status: 'invalid' });
      return;
    }
    let cancelled = false;
    const fail = (error: unknown) => {
      console.error('Auth action failed', error);
      if (!cancelled) setState({ status: 'invalid' });
    };
    if (mode === 'verifyEmail') {
      applyActionCode(auth, oobCode)
        .then(() => {
          if (!cancelled) setState({ status: 'verified' });
        })
        .catch(fail);
    } else {
      verifyPasswordResetCode(auth, oobCode)
        .then((email) => {
          if (!cancelled) setState({ status: 'reset_form', email });
        })
        .catch(fail);
    }
    return () => {
      cancelled = true;
    };
  }, [mode, oobCode]);

  const submitNewPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth || state.status !== 'reset_form') return;
    setFormError('');
    const parsed = signUpPasswordSchema.safeParse(password);
    if (!parsed.success) {
      setFormError(password.length > 128 ? copy.passwordTooLong : copy.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setFormError(copy.passwordMismatch);
      return;
    }
    setState({ status: 'submitting', email: state.email });
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setState({ status: 'reset_done' });
    } catch (error) {
      console.error('Password reset failed', error);
      const code = (error as { code?: string })?.code;
      if (code === 'auth/weak-password') {
        setFormError(copy.passwordTooShort);
        setState({ status: 'reset_form', email: state.email });
      } else {
        setState({ status: 'invalid' });
      }
    }
  };

  const continueHref = state.status === 'verified' && signedIn ? '/dashboard' : '/login';
  const continueLabel = state.status === 'verified' && signedIn ? copy.verifiedCta : copy.backToLogin;

  return (
    <main
      id="main-content"
      className="backdrop-mint min-h-screen flex flex-col justify-center items-center px-4 py-8 font-sans"
    >
      <div className="w-full max-w-[420px] bg-surface-container-lowest p-6 sm:p-8 rounded-[2rem] border border-outline-variant shadow-floating flex flex-col gap-5">
        {/* Logo & wordmark — identical placement to /login */}
        <div className="flex flex-col items-center text-center gap-1">
          <a href="/" className="flex flex-col items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-128.png" alt={m.common.appName} width={64} height={64} className="object-contain" fetchPriority="high" />
            <span className="font-display text-[32px] font-semibold text-on-surface tracking-[-0.03em]">
              smartjib<span className="text-lime-deep dark:text-lime">.</span>
            </span>
          </a>
        </div>

        {state.status === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
            <div className="size-11 rounded-full border-[3px] border-outline-variant border-t-primary animate-spin" aria-hidden="true" />
            <p className="text-[15px] font-medium text-on-surface-variant">
              {mode === 'verifyEmail' ? copy.verifyWorking : mode === 'resetPassword' ? copy.resetWorkingTitle : copy.checkingLink}
            </p>
          </div>
        )}

        {state.status === 'verified' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="size-14 rounded-full bg-lime/60 flex items-center justify-center">
              <AppIcon name="check_circle" className="text-forest text-[30px]" />
            </div>
            <h1 className="font-display text-[24px] font-semibold text-on-surface tracking-[-0.02em]">{copy.verifiedTitle}</h1>
            <p className="text-[14px] text-on-surface-variant leading-relaxed">{copy.verifiedBody}</p>
            <a
              href={continueHref}
              className="w-full mt-1 py-3 bg-primary hover:bg-primary text-on-primary text-center text-[14px] font-bold rounded-full transition-all shadow-ambient cursor-pointer"
            >
              {continueLabel}
            </a>
          </div>
        )}

        {(state.status === 'reset_form' || state.status === 'submitting') && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <h1 className="font-display text-[24px] font-semibold text-on-surface tracking-[-0.02em]">{copy.resetTitle}</h1>
              <p className="text-[14px] text-on-surface-variant leading-relaxed mt-1">{t(copy.resetBody, { email: state.email })}</p>
            </div>
            {formError && (
              <div className="p-3.5 bg-error/10 border border-error/30 rounded-2xl text-[14px] text-error font-medium">{formError}</div>
            )}
            <form onSubmit={submitNewPassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-password" className="text-[13px] font-bold text-on-surface-variant">
                  {copy.newPassword}
                </label>
                <div className="relative flex items-center">
                  <AppIcon name="lock" className="absolute start-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full ps-10 pe-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl text-base text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:bg-surface-container-lowest focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm-password" className="text-[13px] font-bold text-on-surface-variant">
                  {copy.confirmPassword}
                </label>
                <div className="relative flex items-center">
                  <AppIcon name="lock" className="absolute start-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    className="w-full ps-10 pe-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl text-base text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:bg-surface-container-lowest focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={state.status === 'submitting'}
                className="w-full mt-1 py-3 bg-primary hover:bg-primary text-on-primary text-[14px] font-bold rounded-full transition-all shadow-ambient cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {state.status === 'submitting' ? copy.resetWorking : copy.resetSubmit}
              </button>
            </form>
          </div>
        )}

        {state.status === 'reset_done' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="size-14 rounded-full bg-lime/60 flex items-center justify-center">
              <AppIcon name="check_circle" className="text-forest text-[30px]" />
            </div>
            <h1 className="font-display text-[24px] font-semibold text-on-surface tracking-[-0.02em]">{copy.resetDone}</h1>
            <p className="text-[14px] text-on-surface-variant leading-relaxed">{copy.resetDoneBody}</p>
            <a
              href="/login"
              className="w-full mt-1 py-3 bg-primary hover:bg-primary text-on-primary text-center text-[14px] font-bold rounded-full transition-all shadow-ambient cursor-pointer"
            >
              {copy.backToLogin}
            </a>
          </div>
        )}

        {state.status === 'invalid' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="size-14 rounded-full bg-error/10 flex items-center justify-center">
              <AppIcon name="error" className="text-error text-[30px]" />
            </div>
            <h1 className="font-display text-[24px] font-semibold text-on-surface tracking-[-0.02em]">{copy.invalidTitle}</h1>
            <p className="text-[14px] text-on-surface-variant leading-relaxed">{copy.invalidBody}</p>
            <a
              href="/login"
              className="w-full mt-1 py-3 bg-primary hover:bg-primary text-on-primary text-center text-[14px] font-bold rounded-full transition-all shadow-ambient cursor-pointer"
            >
              {copy.backToLogin}
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

export default function AuthActionPageWithBoundary() {
  // useSearchParams must sit inside a suspense boundary for static prerender.
  return (
    <Suspense fallback={null}>
      <AuthActionPage />
    </Suspense>
  );
}
