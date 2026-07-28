import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-xl gap-md">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="font-label-lg text-label-lg text-on-surface-variant font-bold">
        Loading Flousy...
      </span>
    </div>
  );
}
