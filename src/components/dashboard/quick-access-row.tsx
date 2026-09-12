'use client';

import { useRouter } from 'next/navigation';
import { AppIcon } from '@/components/ui/app-icon';
import { getLocalizedNavLabel, getMobileQuickAccessItems } from './nav-items';
import { useLanguage } from '@/lib/i18n-context';

/**
 * Mobile-only quick-access row on the dashboard: chips to the screens that
 * are unreachable from the five-slot bottom nav or the dashboard itself
 * (knowledge, analytics and Darat for Pro users — on md+ the sidebar lists
 * them, so the row hides there). The list is plan-aware: free users get no
 * row at all, since every destination it can list is Pro-gated.
 */
export function QuickAccessRow({ isPro }: { isPro: boolean }) {
  const router = useRouter();
  const { messages: m } = useLanguage();
  const items = getMobileQuickAccessItems(isPro);
  if (items.length === 0) return null;

  return (
    <nav aria-label={m.navigation.quickAccess} className="md:hidden">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => router.push(item.href)}
            className="flex shrink-0 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-2 shadow-ambient transition-colors hover:bg-surface-container-high"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lime text-forest-deep">
              <AppIcon name={item.mobileIcon} className="text-[13px]" />
            </span>
            <span className="whitespace-nowrap text-[13px] font-semibold text-on-surface">
              {getLocalizedNavLabel(item, m)}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
