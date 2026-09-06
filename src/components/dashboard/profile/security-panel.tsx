'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n-context';
import { useHousehold } from '@/lib/household-context';
import { isProFeatureUnlocked } from '@/lib/household';
import { useDashboard } from '../dashboard-provider';
import { trackEvent } from '@/lib/analytics';
import {
  LOCK_TIMEOUT_OPTIONS,
  disableAppLock,
  enableAppLock,
  isBiometricAvailable,
  isValidPin,
  readAppLockSettings,
  registerBiometric,
  removeBiometric,
  setLockTimeout,
  type AppLockSettings,
  type LockTimeout,
} from '@/lib/app-lock';

function notifyGate() {
  window.dispatchEvent(new Event('flousy:lock-settings'));
}

export function SecurityPanel() {
  const { user, profile } = useAuth();
  const { isPro, openProModal } = useDashboard();
  const { workspace, household } = useHousehold();
  const { messages: m } = useLanguage();
  const c = m.appLock;
  const unlocked = isProFeatureUnlocked(isPro, workspace, household);

  const [settings, setSettings] = useState<AppLockSettings>({ enabled: false, timeoutSeconds: 0, biometricEnabled: false });
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSettings(readAppLockSettings());
    void isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  const timeoutLabel: Record<LockTimeout, string> = {
    0: c.timeoutNow,
    60: c.timeout1m,
    300: c.timeout5m,
    900: c.timeout15m,
  };

  const handleEnable = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isValidPin(pin)) return setError(c.pinInvalid);
    if (pin !== confirm) return setError(c.pinMismatch);
    setBusy(true);
    const ok = await enableAppLock(pin);
    setBusy(false);
    if (ok) {
      setPin('');
      setConfirm('');
      setSettings(readAppLockSettings());
      trackEvent('app_lock_enabled');
      notifyGate();
    }
  };

  const handleDisable = () => {
    disableAppLock();
    setSettings(readAppLockSettings());
    trackEvent('app_lock_disabled');
    notifyGate();
  };

  const handleBiometric = async (next: boolean) => {
    setError(null);
    if (!next) {
      removeBiometric();
      setSettings(readAppLockSettings());
      return;
    }
    setBusy(true);
    const ok = await registerBiometric(profile?.displayName || user?.email || 'SmartJib');
    setBusy(false);
    if (!ok) setError(c.biometricUnavailable);
    setSettings(readAppLockSettings());
  };

  if (!unlocked) {
    return (
      <section className="rounded-3xl border border-outline-variant bg-surface-container p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <AppIcon name="lock" className="text-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-on-surface">{c.title}</h3>
            <p className="mt-1 text-sm text-on-surface-variant">{m.profile.pro.features.appLock.description}</p>
            <button
              type="button"
              onClick={openProModal}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary"
            >
              <AppIcon name="workspace_premium" className="text-[16px]" />
              {m.insights.unlock}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-3xl border border-outline-variant bg-surface-container p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <AppIcon name={settings.enabled ? 'lock' : 'lock_open'} className="text-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-on-surface">{c.title}</h3>
            <p className="mt-1 text-sm text-on-surface-variant">{c.description}</p>
            {settings.enabled && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                <AppIcon name="check_circle" className="text-[14px]" />
                {c.enabled}
              </p>
            )}
          </div>
        </div>

        {!settings.enabled ? (
          <form onSubmit={handleEnable} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold text-on-surface">
              {c.setPin}
              <input
                type="password"
                inputMode="numeric"
                pattern="\d*"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="rounded-2xl border border-outline-variant bg-surface px-4 py-3 font-mono text-lg tracking-[0.4em] text-on-surface outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-on-surface">
              {c.confirmPin}
              <input
                type="password"
                inputMode="numeric"
                pattern="\d*"
                maxLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
                className="rounded-2xl border border-outline-variant bg-surface px-4 py-3 font-mono text-lg tracking-[0.4em] text-on-surface outline-none focus:border-primary"
              />
            </label>
            {error && <p className="text-sm font-semibold text-error">{error}</p>}
            <button
              type="submit"
              disabled={busy || pin.length < 4}
              className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-on-primary disabled:opacity-50"
            >
              {c.enable}
            </button>
          </form>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-on-surface">{c.timeout}</span>
              <div className="flex flex-wrap justify-end gap-1.5">
                {LOCK_TIMEOUT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setLockTimeout(option);
                      setSettings(readAppLockSettings());
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                      settings.timeoutSeconds === option
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {timeoutLabel[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <AppIcon name="fingerprint" className="text-[18px] text-primary" />
                  {c.biometricToggle}
                </span>
                {!biometricAvailable && (
                  <p className="mt-0.5 text-xs text-on-surface-variant">{c.biometricUnavailable}</p>
                )}
              </div>
              <Switch
                checked={settings.biometricEnabled}
                disabled={!biometricAvailable || busy}
                onCheckedChange={(next) => void handleBiometric(next)}
              />
            </div>
            {error && <p className="text-sm font-semibold text-error">{error}</p>}

            <button
              type="button"
              onClick={handleDisable}
              className="self-start rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-error hover:bg-error/5"
            >
              {c.disable}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
