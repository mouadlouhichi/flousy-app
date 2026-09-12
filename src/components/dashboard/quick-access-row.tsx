'use client';

import { useRouter } from 'next/navigation';
import { AppIcon } from '@/components/ui/app-icon';
import { getLocalizedNavLabel, getMobileQuickAccessItems } from './nav-items';
import { useLanguage } from '@/lib/i18n-context';

/**
 * Mobile-only quick-access section on the dashboard: tiles for the screens
 * the five-slot bottom nav does not list — courses for everyone, plus
 * knowledge, analytics and Darat for Pro users (on md+ the sidebar lists
 * them, so the whole section hides there). The list is plan-aware:
 * Pro-gated tiles only appear for Pro users.
 */
export function QuickAccessRow({ isPro }: { isPro: boolean }) {
  const router = useRouter();
  const { messages: m } = useLanguage();
  const items = getMobileQuickAccessItems(isPro);
  if (items.length === 0) return null;

  return (
    <nav aria-label={m.navigation.quickAccess} className="md:hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5 px-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime text-forest-deep">
            <AppIcon name="zap" strokeWidth={2.2} className="text-[15px]" />
          </span>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-on-surface">
            {m.navigation.quickAccess}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.href)}
              className="group flex flex-col items-center gap-2.5 rounded-[1.5rem] border border-outline-variant bg-surface-container-lowest px-2 py-4 shadow-ambient transition-all hover:border-lime hover:bg-surface-container-high active:scale-[0.98]"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-lime/20 text-forest-deep transition-colors group-hover:bg-lime dark:bg-lime/10 dark:text-lime">
                <AppIcon name={item.mobileIcon} className="text-[20px]" />
              </span>
              <span className="text-center text-[12px] font-semibold leading-tight text-on-surface">
                {getLocalizedNavLabel(item, m)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
