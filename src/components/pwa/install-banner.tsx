'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useEffect, useState } from 'react';
import { usePwaInstall } from '../../hooks/use-pwa-install';
import { IosInstallSheet } from './ios-install-sheet';

/**
 * Auto-surfacing install banner. Appears a few seconds after the browser marks
 * the app installable, and stays hidden for two weeks once dismissed.
 */
export function InstallBanner() {
  const { canInstall, isIos, isDismissed, isPrompting, promptInstall, dismiss } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);

  const eligible = (canInstall || isIos) && !isDismissed;

  useEffect(() => {
    if (!eligible) {
      setVisible(false);
      return;
    }
    // Small delay so the banner doesn't fight with first paint.
    const timer = window.setTimeout(() => setVisible(true), 3000);
    return () => window.clearTimeout(timer);
  }, [eligible]);

  if (!eligible) return null;

  const handleInstall = async () => {
    if (isIos && !canInstall) {
      setShowIosSheet(true);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === 'accepted') setVisible(false);
  };

  return (
    <>
      <div
        role="region"
        aria-label="Install Flousy"
        className={`fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md transition-all duration-500 md:inset-x-auto md:right-6 md:bottom-6 ${
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container p-3 shadow-lg backdrop-blur-md">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary">
            <AppIcon name="account_balance_wallet" className=" text-[24px] text-on-primary" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-label-lg text-label-lg font-bold text-on-surface">Install Flousy</p>
            <p className="truncate text-body-sm text-on-surface-variant">
              Faster access, works offline.
            </p>
          </div>

          <button
            type="button"
            onClick={handleInstall}
            disabled={isPrompting}
            className="shrink-0 rounded-xl bg-primary px-4 py-2 font-label-md font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Install
          </button>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="shrink-0 rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
          >
            <AppIcon name="close" className=" text-[20px]" />
          </button>
        </div>
      </div>

      <IosInstallSheet open={showIosSheet} onClose={() => setShowIosSheet(false)} />
    </>
  );
}
