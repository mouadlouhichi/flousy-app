'use client';

import React, { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';

interface ScanLookupCardProps {
  /** The barcode being looked up — shown so the user can verify the read. */
  code?: string;
  labels: {
    /** Stage 0 (0–4s): the search is running. */
    searching: string;
    /** Stage 1 (4–10s): still working — set expectations. */
    slowHint: string;
    /** Stage 2 (10s+): the proxy is walking the backup instances. */
    verySlowHint: string;
  };
  className?: string;
}

/**
 * Rich "lookup in progress" card shared by the courses scanner and the
 * expense sheet. A first scan after a cold start can legitimately take up to
 * ~15s (server-side walk over five product instances), so the card
 * communicates progress instead of a static "Loading…":
 *   - an animated ring (not just a pulsing icon),
 *   - the code being looked up,
 *   - a skeleton preview of the result card the user is about to see,
 *   - staged hints as the wait stretches (4s, 10s).
 */
export function ScanLookupCard({ code, labels, className }: ScanLookupCardProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t4 = setTimeout(() => setStage(1), 4000);
    const t10 = setTimeout(() => setStage(2), 10000);
    return () => {
      clearTimeout(t4);
      clearTimeout(t10);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container p-4 ${className ?? ''}`}
    >
      <div className="flex items-center gap-3">
        {/* Spinner ring */}
        <span
          aria-hidden="true"
          className="size-5 shrink-0 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
        />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2 font-body-md text-body-md text-on-surface">
            <span className="min-w-0 truncate">{labels.searching}</span>
            {code && (
              <span className="shrink-0 font-mono text-[12px] tabular-nums text-on-surface-variant" dir="ltr">
                {code}
              </span>
            )}
          </p>
          {stage >= 1 && (
            <p className="mt-0.5 font-label-sm text-label-sm font-medium text-tertiary">
              {stage >= 2 ? labels.verySlowHint : labels.slowHint}
            </p>
          )}
        </div>
      </div>

      {/* Skeleton of the result card the user is about to see */}
      <div aria-hidden="true" className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
        <span className="size-14 shrink-0 animate-pulse rounded-xl bg-surface-variant" />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="h-3 w-2/3 animate-pulse rounded-full bg-surface-variant" />
          <span className="h-3 w-1/3 animate-pulse rounded-full bg-surface-variant" />
        </span>
        <AppIcon name="search" className="size-4 shrink-0 animate-pulse text-primary/60" />
      </div>
    </div>
  );
}
