'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n-context';
import {
  readAppLockSettings,
  shouldLock,
  touchAppLock,
  unlockWithBiometric,
  verifyPin,
  type AppLockSettings,
} from '@/lib/app-lock';

/**
 * Full-screen PIN / biometric gate over the dashboard. Device-local: it is a
 * privacy screen for a shared phone, not an auth boundary. Re-locks when the
 * tab is hidden longer than the configured timeout.
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const { messages: m } = useLanguage();
  const c = m.appLock;
  const [settings, setSettings] = useState<AppLockSettings | null>(null);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const unlockedRef = useRef(false);
  const biometricTriedRef = useRef(false);

  const refresh = useCallback(() => {
    const next = readAppLockSettings();
    setSettings(next);
    setLocked(shouldLock(unlockedRef.current, next));
  }, []);

  useEffect(() => {
    refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') touchAppLock();
      else refresh();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key.startsWith('flousy_lock_')) refresh();
    };
    const onActivity = () => {
      if (!locked) touchAppLock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('flousy:lock-settings', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('flousy:lock-settings', refresh);
    };
  }, [locked, refresh]);

  const unlock = useCallback(() => {
    unlockedRef.current = true;
    touchAppLock();
    setLocked(false);
    setPin('');
    setError(null);
  }, []);

  const tryBiometric = useCallback(async () => {
    if (!settings?.biometricEnabled || busy) return;
    setBusy(true);
    const ok = await unlockWithBiometric();
    setBusy(false);
    if (ok) unlock();
    else setError(c.biometricFailed);
  }, [busy, c.biometricFailed, settings?.biometricEnabled, unlock]);

  // Offer biometrics automatically the first time the lock screen appears.
  useEffect(() => {
    if (locked && settings?.biometricEnabled && !biometricTriedRef.current) {
      biometricTriedRef.current = true;
      void tryBiometric();
    }
    if (!locked) biometricTriedRef.current = false;
  }, [locked, settings?.biometricEnabled, tryBiometric]);

  const submitPin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await verifyPin(pin);
    setBusy(false);
    if (ok) unlock();
    else {
      setError(c.wrongPin);
      setPin('');
    }
  };

  if (!locked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface px-6" role="dialog" aria-modal="true" aria-label={c.lockedHeading}>
      <form onSubmit={submitPin} className="flex w-full max-w-xs flex-col items-center gap-5 text-center">
        <span className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <AppIcon name="lock" className="text-[32px]" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold text-on-surface">{c.lockedHeading}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{c.enterPin}</p>
        </div>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          pattern="\d*"
          maxLength={8}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''));
            setError(null);
          }}
          aria-label={c.enterPin}
          className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-on-surface outline-none focus:border-primary"
        />
        {error && <p className="text-sm font-semibold text-error">{error}</p>}
        <button
          type="submit"
          disabled={pin.length < 4 || busy}
          className="w-full rounded-full bg-primary px-5 py-3 font-bold text-on-primary transition-opacity disabled:opacity-50"
        >
          {c.unlock}
        </button>
        {settings?.biometricEnabled && (
          <button
            type="button"
            onClick={tryBiometric}
            disabled={busy}
            className="flex items-center gap-2 text-sm font-bold text-primary"
          >
            <AppIcon name="fingerprint" className="text-[20px]" />
            {c.useBiometric}
          </button>
        )}
        <p className="text-xs text-on-surface-variant">{c.forgotHint}</p>
        <button type="button" onClick={() => void signOut()} className="text-xs font-semibold text-on-surface-variant underline">
          {c.signOutInstead}
        </button>
      </form>
    </div>
  );
}
