'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React from 'react';
import { useLightLanguage } from '@/lib/i18n-light';
import { isProviderIdentityError } from '@/lib/client-error-classify';
import { reportClientError } from '@/components/observability-reporter';

/** Session-guarded self-heal for stale module graphs (see below). */
const CONTEXT_RELOAD_KEY = 'smartjib:ctx-reload-at';
const CONTEXT_RELOAD_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Attempt a one-shot full reload for React context-identity failures.
 *
 * Returns true when a reload was triggered. The guard is timestamped, not a
 * permanent flag: a genuine provider bug must surface as the normal error UI
 * (reload once, then stop), while a *later* stale-chunk incident in the same
 * long-lived tab still self-heals.
 */
function maybeReloadStaleModuleGraph(message: unknown): boolean {
  if (!isProviderIdentityError(message)) return false;
  try {
    const raw = window.sessionStorage.getItem(CONTEXT_RELOAD_KEY);
    const last = raw ? Number(raw) : NaN;
    if (Number.isFinite(last) && Date.now() - last < CONTEXT_RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(CONTEXT_RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage unavailable (private mode): reload once anyway — a second
    // consecutive boundary mount for the same render means `reset()` already
    // failed, and a reload is still the only recovery for this class.
  }
  window.location.reload();
  return true;
}

export default function ErrorPage({ error, reset }: { error?: Error; reset?: () => void }) {
  const { messages: m } = useLightLanguage();

  // Render errors are swallowed by this boundary and never reach the global
  // 'error' listener, so the boundary itself files the report. The beacon
  // goes out first: sendBeacon survives the reload below, so a healed
  // incident is still visible in the server log (exactly one beacon, no
  // follow-up) while a genuine bug shows up twice — before and after.
  React.useEffect(() => {
    if (!error) return;
    reportClientError('boundary', error.message, error.stack);
    maybeReloadStaleModuleGraph(error.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-xl text-center gap-md">
      <AppIcon name="warning" className="text-error text-[56px]" />
      <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold">
        {m.errors.generic}
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
        {m.errors.unexpected}
      </p>
      {reset && (
        <button
          onClick={reset}
          className="mt-sm px-6 py-3 bg-primary text-on-primary font-headline-md text-headline-md rounded-xl shadow-sm hover:bg-primary-container"
        >
          {m.errors.tryAgain}
        </button>
      )}
    </div>
  );
}
