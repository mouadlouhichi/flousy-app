'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState } from 'react';
import { usePwaInstall } from '../../hooks/use-pwa-install';
import { IosInstallSheet } from './ios-install-sheet';

interface InstallButtonProps {
  className?: string;
  /** Hide the text label on small screens (icon-only). */
  compact?: boolean;
}

/**
 * Explicit "Install app" control. Renders nothing when the app is already
 * installed or the browser has no install path.
 */
export function InstallButton({ className = '', compact = false }: InstallButtonProps) {
  const { canInstall, isIos, isPrompting, promptInstall } = usePwaInstall();
  const [showIosSheet, setShowIosSheet] = useState(false);

  if (!canInstall && !isIos) return null;

  const handleClick = async () => {
    if (isIos && !canInstall) {
      setShowIosSheet(true);
      return;
    }
    await promptInstall();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPrompting}
        aria-label="Install Flousy app"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-label-md font-bold border border-primary/25 bg-primary/10 text-primary transition-all hover:bg-primary/20 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        <AppIcon name="install_mobile" className=" text-[18px]" />
        <span className={compact ? 'hidden sm:inline' : ''}>Install</span>
      </button>

      <IosInstallSheet open={showIosSheet} onClose={() => setShowIosSheet(false)} />
    </>
  );
}
