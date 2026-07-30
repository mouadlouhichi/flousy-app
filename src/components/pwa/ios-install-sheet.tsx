'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useEffect, useRef } from 'react';

interface IosInstallSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * iOS Safari never fires `beforeinstallprompt`, so installing has to be
 * explained rather than triggered.
 */
export function IosInstallSheet({ open, onClose }: IosInstallSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2
            id="ios-install-title"
            className="font-headline-sm text-headline-sm font-extrabold text-on-surface"
          >
            Install SmartJib
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
          >
            <AppIcon name="close" className=" text-[20px]" />
          </button>
        </div>

        <p className="mb-5 text-body-md text-on-surface-variant">
          Add SmartJib to your Home Screen for a full-screen, app-like experience.
        </p>

        <ol className="space-y-3">
          {[
            { icon: 'ios_share', text: 'Tap the Share button in the Safari toolbar' },
            { icon: 'add_box', text: 'Choose "Add to Home Screen"' },
            { icon: 'check_circle', text: 'Tap "Add" to finish' },
          ].map((step, index) => (
            <li key={step.icon} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-label-md font-bold text-primary">
                {index + 1}
              </span>
              <AppIcon name={step.icon} className=" text-[22px] text-primary" />
              <span className="text-body-md text-on-surface">{step.text}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-primary px-4 py-3 font-label-lg font-bold text-on-primary transition-opacity hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
