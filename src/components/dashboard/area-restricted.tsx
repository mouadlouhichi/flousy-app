'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import type { HouseholdArea } from '@/lib/household-rbac';

interface AreaRestrictedProps {
  /** The RBAC area the member was denied. Drives the copy. */
  area: HouseholdArea;
  icon?: string;
}

/**
 * Shown in place of a whole screen the member's household role excludes.
 *
 * It deliberately renders no numbers, no blurred content and no counts — a
 * placeholder that hints at the shape of the hidden data is still a leak. The
 * same panel is used for every area so the wording cannot drift per screen.
 */
export function AreaRestricted({ area, icon = 'lock' }: AreaRestrictedProps) {
  const { messages: m, t } = useLanguage();
  const label = m.household.areas[area];

  return (
    <div
      role="status"
      className="rounded-3xl border border-outline-variant bg-surface-container p-8 text-center"
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-variant text-on-surface-variant">
        <AppIcon name={icon} className="text-[22px]" />
      </span>
      <p className="mt-4 text-sm font-bold text-on-surface">
        {t(m.household.areaPrivateTitle, { area: label })}
      </p>
      <p className="mt-2 text-xs text-on-surface-variant">
        {t(m.household.areaPrivateDescription, { area: label })}
      </p>
    </div>
  );
}
