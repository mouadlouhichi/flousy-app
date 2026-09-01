'use client';

import Link from 'next/link';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import type { Messages } from '@/lib/i18n-core';

type ProfileSubpageMessageKey = keyof Messages['profile']['subpages'];

export function ProfileSubpage({
  titleKey,
  descriptionKey,
  children,
}: {
  titleKey: ProfileSubpageMessageKey;
  descriptionKey?: ProfileSubpageMessageKey;
  children: React.ReactNode;
}) {
  const { messages: m, isRTL } = useLanguage();
  const copy = m.profile.subpages;
  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex items-start gap-3">
        <Link
          href="/dashboard/profile"
          prefetch={true}
          aria-label={copy.backToProfile}
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
        >
          <AppIcon name="arrow_back" className={`text-[18px] ${isRTL ? 'rotate-180' : ''}`} />
        </Link>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-on-surface">{copy[titleKey]}</h2>
          {descriptionKey && (
            <p className="mt-0.5 text-sm text-on-surface-variant">{copy[descriptionKey]}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
