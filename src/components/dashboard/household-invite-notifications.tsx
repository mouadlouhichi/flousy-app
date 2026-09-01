'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useHousehold } from '@/lib/household-context';
import { useLanguage } from '@/lib/i18n-context';
import { localizeHouseholdRole } from '@/lib/localized-labels';

export function HouseholdInviteNotifications() {
  const { pendingInvites } = useHousehold();
  const { messages: m, t, intlLocale } = useLanguage();
  const h = m.household;
  const [open, setOpen] = useState(false);

  if (!pendingInvites.length) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t(h.invitationCount, { count: pendingInvites.length })}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-primary hover:bg-primary/10"
      >
        <AppIcon name="notifications" className="text-[21px]" />
        <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-on-primary">
          {new Intl.NumberFormat(intlLocale).format(pendingInvites.length)}
        </span>
      </button>
      {open && (
        <div className="absolute end-0 top-11 z-50 w-80 rounded-2xl border border-outline-variant bg-surface p-3 shadow-lg">
          <p className="mb-2 text-sm font-bold text-on-surface">{h.invitations}</p>
          {pendingInvites.map((invite) => (
            <Link
              key={invite.id}
              href={`/dashboard/profile/household?invite=${encodeURIComponent(invite.id)}`}
              onClick={() => setOpen(false)}
              className="block rounded-xl p-3 hover:bg-surface-container"
            >
              <p className="text-sm font-semibold text-on-surface">
                {t(h.invitedAs, { role: localizeHouseholdRole(invite.role, m) })}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">{h.reviewAndJoin}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
