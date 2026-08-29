'use client';

import Link from 'next/link';
import { AppIcon } from '@/components/ui/app-icon';

export function ProfileSubpage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex items-start gap-3">
        <Link
          href="/dashboard/profile"
          prefetch={false}
          aria-label="Back to profile"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
        >
          <AppIcon name="arrow_back" className="text-[18px]" />
        </Link>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-on-surface">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-on-surface-variant">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
