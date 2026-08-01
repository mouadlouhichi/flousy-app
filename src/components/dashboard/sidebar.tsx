'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { AppIcon } from '@/components/ui/app-icon';
import { useDashboard } from './dashboard-provider';
import { getScreenIdFromPath, getVisibleNavItems } from './nav-items';
import { useHousehold } from '@/lib/household-context';
import { isProFeatureUnlocked } from '@/lib/household';

/**
 * Desktop left sidebar navigation (hidden on mobile).
 *
 * The active item background is a single pill that slides from the current
 * page's item to the target page's item on navigation (shared `layoutId`
 * animation), mirroring the horizontal slide of the mobile bottom nav.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { user, profile, isPro, openIncomeModal, openCsvModal, openProModal } = useDashboard();
  const { workspace } = useHousehold();
  const proUnlocked = isProFeatureUnlocked(isPro, workspace);
  const activeScreen = getScreenIdFromPath(pathname);
  const items = getVisibleNavItems(proUnlocked);

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-surface-variant bg-surface shrink-0 fixed top-0 bottom-0 left-0 z-30">
      {/* Brand Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-surface-variant/50">
        <Image
          src="/logo.png"
          alt="SmartJib logo"
          width={40}
          height={40}
          className="object-contain"
          priority
        />
        <span className="font-headline-md text-headline-md font-extrabold text-primary tracking-tight">
          SmartJib
        </span>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = activeScreen === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={false}
              className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl font-label-lg transition-colors ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {/* Sliding active background — glides from the previously
                  active item to this one on navigation. */}
              {isActive && (
                <motion.span
                  layoutId="dashboard-sidebar-active-bg"
                  className="absolute inset-0 rounded-2xl bg-primary/10 shadow-xs"
                  transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.9 }}
                />
              )}
              <AppIcon
                name={item.sidebarIcon}
                className={`relative z-10 text-[22px] ${isActive ? 'filled' : ''}`}
              />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}

        <div className="my-2 border-t border-surface-variant/40" />

        {/* Quick Tools */}
        <button
          onClick={() => {
            if (!proUnlocked) {
              openProModal();
              return;
            }
            openIncomeModal();
          }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface transition-all"
        >
          <AppIcon name="payments" className=" text-[20px]" />
          <span>Income Sources</span>
        </button>

        <button
          onClick={() => {
            if (!proUnlocked) {
              openProModal();
              return;
            }
            openCsvModal();
          }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface transition-all"
        >
          <AppIcon name="upload_file" className=" text-[20px]" />
          <span>Import / Export CSV</span>
        </button>
      </nav>

      {/* Bottom Profile Footer — whole row opens the profile page. */}
      <div className="p-4 border-t border-surface-variant/50 flex items-center justify-between gap-2 bg-surface-container/20">
        <Link
          href="/dashboard/profile"
          prefetch={false}
          aria-current={activeScreen === 'profile' ? 'page' : undefined}
          className={`flex flex-1 items-center gap-3 overflow-hidden rounded-2xl p-1.5 -m-1.5 transition-colors ${
            activeScreen === 'profile' ? 'bg-primary/10' : 'hover:bg-surface-variant/50'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0">
            {profile?.displayName
              ? profile.displayName.charAt(0).toUpperCase()
              : user?.email
                ? user.email.charAt(0).toUpperCase()
                : 'A'}
          </div>
          <div className="flex flex-col truncate">
            <span className="font-label-lg font-bold text-on-surface truncate">
              {profile?.displayName || (user?.email ? user.email.split('@')[0] : 'Amine Bennani')}
            </span>
            <span className="font-label-sm text-[10px] text-primary uppercase font-extrabold tracking-wider">
              {isPro ? 'PRO PLAN' : 'FREE PLAN'}
            </span>
          </div>
        </Link>
        <Link
          href="/dashboard/profile"
          prefetch={false}
          className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-xl transition-colors shrink-0"
          title="Profile & Account"
          aria-label="Profile & Account"
        >
          <AppIcon name="person" className=" text-[20px]" />
        </Link>
      </div>
    </aside>
  );
}
