'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React from 'react';
import { useLightLanguage } from '@/lib/i18n-light';
import { reportClientError } from '@/components/observability-reporter';

export default function ErrorPage({ error, reset }: { error?: Error; reset?: () => void }) {
  const { messages: m } = useLightLanguage();

  // Render errors are swallowed by this boundary and never reach the global
  // 'error' listener, so the boundary itself files the report.
  React.useEffect(() => {
    if (error) reportClientError('boundary', error.message, error.stack);
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
