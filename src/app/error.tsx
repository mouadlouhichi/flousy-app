'use client';

import React from 'react';

export default function ErrorPage({ error, reset }: { error?: Error; reset?: () => void }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-xl text-center gap-md">
      <span className="material-symbols-outlined text-error text-[56px]">warning</span>
      <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold">
        Something went wrong
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
        {error?.message || 'An unexpected error occurred while processing your budget request.'}
      </p>
      {reset && (
        <button
          onClick={reset}
          className="mt-sm px-6 py-3 bg-primary text-on-primary font-headline-md text-headline-md rounded-xl shadow-sm hover:bg-primary-container"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
